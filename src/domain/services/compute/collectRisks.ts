import type { Issue } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import { requirementStages } from "../../models/requirement";
import type { RiskRecord } from "../../models/risk";
import { daysBetween, todayLocalStr } from "../../../utils/date";
import { getDisplayVersion } from "../normalize/parseVersionInfo";

export function isIssueOpen(issue: Issue): boolean {
  return issue.status !== "关闭";
}

export function isRequirementBehindSchedule(requirement: Requirement, today = todayLocalStr()) {
  if (requirement.stage !== "需求开发") return { lagging: false, expected: 0 };
  const devDate = requirement.stageDates["需求开发"];
  const transferDate = requirement.stageDates["需求转测"];
  const total = daysBetween(devDate, transferDate);
  const elapsed = daysBetween(devDate, today);
  if (total === null || elapsed === null || total <= 0) return { lagging: false, expected: 0 };
  const expected = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
  return { lagging: requirement.progressPercent + 15 < expected, expected };
}

function createRequirementRisk(requirement: Requirement, level: RiskRecord["level"], reason: string): RiskRecord {
  return {
    type: "需求风险",
    id: requirement.id,
    itemId: requirement.id,
    title: requirement.title,
    level,
    version: getDisplayVersion(requirement),
    versionLine: requirement.versionLine,
    releaseVersion: requirement.releaseVersion,
    cycleVersion: requirement.cycleVersion,
    fullVersion: requirement.fullVersion,
    owner: requirement.riskOwner,
    sourceType: "requirement",
    text: reason,
    reason,
    requirementId: requirement.id
  };
}

function createIssueRisk(issue: Issue, level: RiskRecord["level"], reason: string): RiskRecord {
  return {
    type: "问题单风险",
    id: issue.id,
    itemId: issue.id,
    title: issue.title,
    level,
    version: getDisplayVersion(issue),
    versionLine: issue.versionLine,
    releaseVersion: issue.releaseVersion,
    cycleVersion: issue.cycleVersion,
    fullVersion: issue.fullVersion,
    owner: issue.riskOwner,
    sourceType: "issue",
    text: reason,
    reason,
    issueId: issue.id
  };
}

export function detectRequirementRisks(requirements: Requirement[], issues: Issue[], today = todayLocalStr()): RiskRecord[] {
  const issuesByRequirement = new Map<string, Issue[]>();
  issues.forEach((issue) => {
    const current = issuesByRequirement.get(issue.requirementId) || [];
    current.push(issue);
    issuesByRequirement.set(issue.requirementId, current);
  });

  const risks: RiskRecord[] = [];
  requirements.forEach((requirement) => {
    const relatedIssues = issuesByRequirement.get(requirement.id) || [];
    const waitDays = requirement.status === "待处理" && requirement.createTime ? daysBetween(requirement.createTime, today) : null;
    if (waitDays !== null && waitDays > 7) {
      risks.push(createRequirementRisk(requirement, "中", `需求处于“待处理”已超过 ${waitDays} 天`));
    }
    if (requirement.risk) {
      risks.push(createRequirementRisk(requirement, "中", `需求风险字段已标记：${requirement.risk}`));
    }
    const currentStageDate = requirement.stageDates[requirement.stage];
    if (currentStageDate && (daysBetween(currentStageDate, today) || 0) > 0) {
      risks.push(createRequirementRisk(requirement, "高", `当前阶段“${requirement.stage}”计划日期 ${currentStageDate} 已逾期`));
    }
    const stageIndex = requirementStages.indexOf(requirement.stage as (typeof requirementStages)[number]);
    if (stageIndex >= 0) {
      const nextStage = requirementStages[stageIndex + 1];
      const nextDate = nextStage ? requirement.stageDates[nextStage] : "";
      if (nextDate) {
        const distance = daysBetween(today, nextDate);
        if (distance !== null && distance < 0) risks.push(createRequirementRisk(requirement, "高", `下一阶段“${nextStage}”计划日期 ${nextDate} 已超期`));
        else if (distance !== null && distance <= 2) risks.push(createRequirementRisk(requirement, "中", `下一阶段“${nextStage}”计划日期 ${nextDate} 临近`));
      }
    }
    const lagInfo = isRequirementBehindSchedule(requirement, today);
    if (lagInfo.lagging) {
      risks.push(createRequirementRisk(requirement, "高", `开发进度 ${requirement.progressPercent}% 低于时间进度 ${lagInfo.expected}%`));
    }
    const openCount = relatedIssues.filter(isIssueOpen).length;
    if (["问题单清理", "需求上线"].includes(requirement.stage) && openCount > 0) {
      risks.push(createRequirementRisk(requirement, "高", `阶段“${requirement.stage}”仍有未关闭问题单 ${openCount} 个`));
    }
  });
  return risks;
}

export function detectIssueRisks(issues: Issue[], today = todayLocalStr()): RiskRecord[] {
  const risks: RiskRecord[] = [];
  issues.forEach((issue) => {
    if (isIssueOpen(issue) && ["紧急", "高"].includes(issue.severity)) {
      risks.push(createIssueRisk(issue, "高", `${issue.severity}严重度问题单尚未关闭`));
    }
    if (isIssueOpen(issue) && issue.dueDate) {
      const distance = daysBetween(today, issue.dueDate);
      if (distance !== null && distance < 0) risks.push(createIssueRisk(issue, "高", `问题单截至日期 ${issue.dueDate} 已超期`));
      else if (distance !== null && distance <= 1) risks.push(createIssueRisk(issue, "中", `问题单截至日期 ${issue.dueDate} 临近`));
    }
    const lagMetrics: Array<[string, number | null]> = [
      ["提交滞留时间", issue.submitLagDays],
      ["定位中滞留时间", issue.analysisLagDays],
      ["修复滞留时间", issue.fixLagDays],
      ["修改中滞留时间", issue.modifyLagDays],
      ["测试滞留时间", issue.testLagDays]
    ];
    lagMetrics.forEach(([label, value]) => {
      if (value === null) return;
      if (value >= 15) risks.push(createIssueRisk(issue, "高", `${label} ${value} 天，滞留时间过长`));
      else if (value >= 7) risks.push(createIssueRisk(issue, "中", `${label} ${value} 天，需要关注滞留`));
    });
    if (issue.isLegacyIssue) risks.push(createIssueRisk(issue, "中", "问题单已标记为遗留问题"));
    if (["问题单清理", "需求上线"].includes(issue.issueStage || issue.stage) && isIssueOpen(issue)) {
      risks.push(createIssueRisk(issue, "高", "上线前阶段仍残留未关闭问题单"));
    }
  });
  return risks;
}

export function collectRisks(requirements: Requirement[], issues: Issue[]): RiskRecord[] {
  const order = { "高": 1, "中": 2, "低": 3 };
  return [...detectRequirementRisks(requirements, issues), ...detectIssueRisks(issues)]
    .sort((a, b) => order[a.level] - order[b.level] || a.itemId.localeCompare(b.itemId, "zh-CN"));
}

export const detectRisks = collectRisks;
