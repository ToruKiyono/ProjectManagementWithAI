import type { Issue } from "../../models/issue";
import { issueStatuses } from "../../models/issue";
import type { IterationTimeline } from "../../models/iterationTimeline";
import type { Requirement } from "../../models/requirement";
import { requirementStages } from "../../models/requirement";
import { daysBetween, todayLocalStr } from "../../../utils/date";

export type RequirementRisk = {
  type: "requirement";
  level: "high" | "medium" | "low";
  itemId: string;
  title: string;
  stage: string;
  owner: string;
  tester: string;
  fullVersion: string;
  reason: string;
};

export type IssueRisk = {
  type: "issue";
  level: "high" | "medium" | "low";
  itemId: string;
  title: string;
  severity: string;
  severityScore: number;
  status: string;
  team: string;
  owner: string;
  tester: string;
  versionRelation: Issue["versionRelation"];
  versionLine: string;
  releaseVersion: string;
  fullVersion: string;
  reason: string;
};

export type IterationStageSummary = {
  stage: string;
  count: number;
  riskCount: number;
  owners: string[];
  testers: string[];
  avgProgressPercent: number;
  riskReasons: string[];
  items: Requirement[];
};

export type IterationSummary = {
  key: string;
  versionLine: string;
  releaseVersion: string;
  cycleVersion: string;
  patchVersion: string;
  fullVersion: string;
  requirementCount: number;
  riskCount: number;
  stageDistribution: Record<string, number>;
  riskOwners: string[];
  onlinePlanTime: string;
  timelineStartDate: string;
  timelineEndDate: string;
  hasBlocker: boolean;
  blockerStages: string[];
  items: Requirement[];
  stages: IterationStageSummary[];
};

export type TeamIssueSummary = {
  team: string;
  total: number;
  open: number;
  severe: number;
  critical: number;
  totalDI: number;
  openDI: number;
  primaryOwners: string[];
  items: Issue[];
};

export type MajorVersionIssueSummary = {
  versionLine: string;
  total: number;
  open: number;
  closed: number;
  riskCount: number;
  totalDI: number;
  openDI: number;
  statusCounts: Record<string, number>;
  severityCounts: Record<string, number>;
  teamSummaries: TeamIssueSummary[];
  releaseGate: {
    passed: boolean;
    reasons: string[];
    metrics: {
      totalDI: number;
      openDI: number;
    };
  };
  items: Issue[];
};

export type OwnerFollowupSummary = {
  requirementOwners: Array<{
    owner: string;
    riskRequirementCount: number;
    iterations: string[];
    stageDistribution: Record<string, number>;
    topItems: RequirementRisk[];
  }>;
  issueOwners: Array<{
    owner: string;
    issueCount: number;
    openIssueCount: number;
    openDI: number;
    teams: string[];
    items: IssueRisk[];
  }>;
};

type ReleaseGateSummary = {
  versionLine: string;
  totalDI: number;
  openDI: number;
  openCriticalCount: number;
  openSevereCount: number;
  teamOpenDI: Record<string, number>;
  earlyRequirementCount: number;
  cleanupNotClosedIterations: string[];
  timelineMissingIterations: string[];
};

function stageIndex(stage: string) {
  const index = requirementStages.indexOf(stage as (typeof requirementStages)[number]);
  return index >= 0 ? index : -1;
}

function isIssueClosed(issue: Issue) {
  return issue.status === "关闭";
}

function getTimelineKey(input: { fullVersion?: string; versionKey?: string; releaseVersion?: string }) {
  return input.fullVersion || input.versionKey || input.releaseVersion || "未分配迭代";
}

export function computeIssueVersionRelation(issue: Issue, currentMajorVersion?: { versionLine?: string; releaseVersion?: string }): Issue["versionRelation"] {
  if (!issue.versionLine) return "none";
  if (!currentMajorVersion?.versionLine) return "current-major";
  if (issue.versionLine !== currentMajorVersion.versionLine) return "old-major";
  if (currentMajorVersion.releaseVersion && issue.releaseVersion && issue.releaseVersion !== currentMajorVersion.releaseVersion) {
    return "old-major";
  }
  return "current-major";
}

export function groupRequirementsByIteration(requirements: Requirement[]) {
  const groups = new Map<string, Requirement[]>();
  requirements.forEach((item) => {
    const key = getTimelineKey(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .map(([key, items]) => ({ key, items }))
    .sort((a, b) => a.key.localeCompare(b.key, "zh-CN"));
}

export function groupRequirementsByStage(requirements: Requirement[]) {
  return [...requirementStages, "未识别阶段"].map((stage) => ({
    stage,
    items: requirements.filter((item) => item.stage === stage)
  }));
}

export function groupIssuesByMajorVersion(issues: Issue[]) {
  const groups = new Map<string, Issue[]>();
  issues.forEach((item) => {
    const key = item.versionLine || "未分配版本";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .map(([versionLine, items]) => ({ versionLine, items }))
    .sort((a, b) => a.versionLine.localeCompare(b.versionLine, "zh-CN"));
}

export function groupIssuesByStatus(issues: Issue[]) {
  return issueStatuses.map((status) => ({
    status,
    items: issues.filter((item) => item.status === status)
  }));
}

export function groupIssuesByTeam(issues: Issue[]) {
  const groups = new Map<string, Issue[]>();
  issues.forEach((item) => {
    const key = item.team || "未分配团队";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .map(([team, items]) => ({ team, items }))
    .sort((a, b) => a.team.localeCompare(b.team, "zh-CN"));
}

export function groupIssuesByOwner(issues: Issue[]) {
  const groups = new Map<string, Issue[]>();
  issues.forEach((item) => {
    const key = item.currentOwner || item.owner || "未分配责任人";
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  });
  return [...groups.entries()]
    .map(([owner, items]) => ({ owner, items }))
    .sort((a, b) => a.owner.localeCompare(b.owner, "zh-CN"));
}

export function detectRequirementRisks(requirements: Requirement[], timelines: IterationTimeline[] = []) {
  const today = todayLocalStr();
  const timelineMap = new Map(timelines.map((item) => [getTimelineKey(item), item]));
  const iterationGroups = groupRequirementsByIteration(requirements);
  const lateStageByIteration = new Map(
    iterationGroups.map((group) => [
      group.key,
      Math.max(...group.items.map((item) => stageIndex(item.stage)).filter((item) => item >= 0), -1)
    ])
  );

  const risks: RequirementRisk[] = [];

  requirements.forEach((item) => {
    const reasons: Array<{ level: RequirementRisk["level"]; reason: string }> = [];
    const currentStageIndex = stageIndex(item.stage);
    const planLeadDays = item.onlinePlanTime ? daysBetween(today, item.onlinePlanTime) : null;
    const iterationLateStage = lateStageByIteration.get(getTimelineKey(item)) ?? -1;
    const ageDays = item.createTime ? daysBetween(item.createTime, today) : null;
    const timeline = timelineMap.get(getTimelineKey(item));
    const iterationEndLeadDays = timeline?.endDate ? daysBetween(today, timeline.endDate) : null;

    if (item.risk) reasons.push({ level: "high", reason: `显式风险: ${item.risk}` });
    if (item.issueCount >= 5) reasons.push({ level: "high", reason: `发现问题数量高 (${item.issueCount})` });
    else if (item.issueCount >= 3) reasons.push({ level: "medium", reason: `发现问题数量偏高 (${item.issueCount})` });
    if (ageDays !== null && ageDays >= 10 && currentStageIndex <= 2) reasons.push({ level: "high", reason: "长时间停留在前期阶段" });
    if (planLeadDays !== null && planLeadDays <= 7 && currentStageIndex < stageIndex("需求转测")) {
      reasons.push({ level: "high", reason: "规划上线时间临近但仍未进入转测/清理/上线" });
    }
    if (iterationEndLeadDays !== null && iterationEndLeadDays <= 3 && currentStageIndex < stageIndex("需求转测")) {
      reasons.push({ level: "high", reason: "小迭代窗口即将结束，但需求仍未进入转测" });
    }
    if (item.progressPercent < 40 && currentStageIndex >= stageIndex("需求开发（跟进度）")) {
      reasons.push({ level: "medium", reason: `进度明显滞后 (${item.progressPercent}%)` });
    }
    if (iterationLateStage >= stageIndex("需求转测") && currentStageIndex >= 0 && currentStageIndex < stageIndex("需求开发（跟进度）")) {
      reasons.push({ level: "medium", reason: "同迭代整体已进入后期，但该需求仍停留在早期阶段" });
    }

    reasons.forEach(({ level, reason }) => {
      risks.push({
        type: "requirement",
        level,
        itemId: item.id,
        title: item.title,
        stage: item.stage,
        owner: item.riskOwner || item.owner,
        tester: item.tester,
        fullVersion: item.fullVersion || item.releaseVersion,
        reason
      });
    });
  });

  return risks;
}

export function detectIssueRisks(issues: Issue[], currentMajorVersion?: { versionLine?: string; releaseVersion?: string }) {
  const today = todayLocalStr();
  const teamOpenDI = summarizeTeamDI(issues).reduce<Record<string, number>>((acc, item) => {
    acc[item.team] = item.openDI;
    return acc;
  }, {});
  const risks: IssueRisk[] = [];

  issues.forEach((issue) => {
    const relation = computeIssueVersionRelation(issue, currentMajorVersion);
    const stalledDaysBase = issue.transferTestTime || issue.fixedTime || issue.createdAt;
    const stalledDays = stalledDaysBase ? daysBetween(stalledDaysBase, today) : null;
    const overdue = issue.dueDate ? (daysBetween(today, issue.dueDate) ?? 1) < 0 : false;
    const reasons: Array<{ level: IssueRisk["level"]; reason: string }> = [];

    if (!isIssueClosed(issue) && issue.severity === "致命") reasons.push({ level: "high", reason: "存在致命未关闭问题单" });
    if (!isIssueClosed(issue) && issue.severity === "严重") reasons.push({ level: "high", reason: "存在严重未关闭问题单" });
    if (overdue && !isIssueClosed(issue)) reasons.push({ level: "high", reason: "超过承诺修复时间" });
    if (!isIssueClosed(issue) && ["已修复", "已转测", "待验收"].includes(issue.status) && stalledDays !== null && stalledDays >= 5) {
      reasons.push({ level: "medium", reason: "已修复/已转测/待验收后长期未推进" });
    }
    if (relation === "none" && !isIssueClosed(issue)) reasons.push({ level: "medium", reason: "未关联版本但影响当前发布" });
    if (relation === "old-major" && !isIssueClosed(issue)) reasons.push({ level: "medium", reason: "关联老版本但影响当前发布" });
    if (!isIssueClosed(issue) && (teamOpenDI[issue.team || "未分配团队"] ?? 0) >= 6) reasons.push({ level: "medium", reason: "所属团队未关闭问题单 DI 过高" });

    reasons.forEach(({ level, reason }) => {
      risks.push({
        type: "issue",
        level,
        itemId: issue.id,
        title: issue.title,
        severity: issue.severity,
        severityScore: issue.severityScore,
        status: issue.status,
        team: issue.team,
        owner: issue.currentOwner || issue.owner,
        tester: issue.tester,
        versionRelation: relation,
        versionLine: issue.versionLine,
        releaseVersion: issue.releaseVersion,
        fullVersion: issue.fullVersion,
        reason
      });
    });
  });

  return risks;
}

export function summarizeIteration(
  iterationNode: { key: string; items: Requirement[] },
  requirements = iterationNode.items,
  timelines: IterationTimeline[] = []
): IterationSummary {
  const items = [...requirements].sort((a, b) => stageIndex(a.stage) - stageIndex(b.stage));
  const requirementRisks = detectRequirementRisks(items, timelines);
  const stageGroups = groupRequirementsByStage(items);
  const blockerStages = stageGroups
    .filter((group) => group.items.length > 0 && detectRequirementRisks(group.items, timelines).length > 0)
    .map((group) => group.stage);
  const onlinePlanTime = [...items].map((item) => item.onlinePlanTime).filter(Boolean).sort()[0] ?? "";
  const timeline = timelines.find((item) => getTimelineKey(item) === (items[0]?.fullVersion ?? iterationNode.key));

  return {
    key: iterationNode.key,
    versionLine: items[0]?.versionLine ?? "",
    releaseVersion: items[0]?.releaseVersion ?? "",
    cycleVersion: items[0]?.cycleVersion ?? "",
    patchVersion: items[0]?.patchVersion ?? "",
    fullVersion: items[0]?.fullVersion ?? iterationNode.key,
    requirementCount: items.length,
    riskCount: new Set(requirementRisks.map((item) => item.itemId)).size,
    stageDistribution: Object.fromEntries(stageGroups.map((group) => [group.stage, group.items.length])),
    riskOwners: [...new Set(requirementRisks.map((item) => item.owner).filter(Boolean))],
    onlinePlanTime,
    timelineStartDate: timeline?.startDate ?? "",
    timelineEndDate: timeline?.endDate ?? "",
    hasBlocker: blockerStages.length > 0,
    blockerStages,
    items,
    stages: stageGroups.map((group) => {
      const groupRisks = requirementRisks.filter((risk) => group.items.some((item) => item.id === risk.itemId));
      return {
        stage: group.stage,
        count: group.items.length,
        riskCount: new Set(groupRisks.map((item) => item.itemId)).size,
        owners: [...new Set(group.items.map((item) => item.owner).filter(Boolean))],
        testers: [...new Set(group.items.map((item) => item.tester).filter(Boolean))],
        avgProgressPercent: group.items.length ? Math.round(group.items.reduce((sum, item) => sum + item.progressPercent, 0) / group.items.length) : 0,
        riskReasons: [...new Set(groupRisks.map((item) => item.reason))],
        items: group.items
      };
    })
  };
}

export function summarizeTeamDI(issues: Issue[]): TeamIssueSummary[] {
  return groupIssuesByTeam(issues)
    .map(({ team, items }) => {
      const openItems = items.filter((item) => !isIssueClosed(item));
      const ownerCounts = new Map<string, number>();
      items.forEach((item) => {
        const owner = item.currentOwner || item.owner || "未分配责任人";
        ownerCounts.set(owner, (ownerCounts.get(owner) ?? 0) + 1);
      });
      const primaryOwners = [...ownerCounts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
        .slice(0, 3)
        .map(([owner]) => owner);
      return {
        team,
        total: items.length,
        open: openItems.length,
        severe: openItems.filter((item) => item.severity === "严重").length,
        critical: openItems.filter((item) => item.severity === "致命").length,
        totalDI: Number(items.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
        openDI: Number(openItems.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
        primaryOwners,
        items
      };
    })
    .sort((a, b) => b.openDI - a.openDI || b.totalDI - a.totalDI || b.open - a.open);
}

export function summarizeMajorVersionIssues(versionLine: string, issues: Issue[]): MajorVersionIssueSummary {
  const items = issues.filter((item) => item.versionLine === versionLine);
  const openItems = items.filter((item) => !isIssueClosed(item));
  const risks = detectIssueRisks(items, { versionLine });
  const teamSummaries = summarizeTeamDI(items);
  const statusCounts = Object.fromEntries(issueStatuses.map((status) => [status, items.filter((item) => item.status === status).length]));
  const severityCounts = Object.fromEntries(["提示", "一般", "严重", "致命"].map((severity) => [severity, items.filter((item) => item.severity === severity).length]));
  const releaseGate = checkMajorVersionReleaseGate({
    versionLine,
    totalDI: Number(items.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    openDI: Number(openItems.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    openCriticalCount: openItems.filter((item) => item.severity === "致命").length,
    openSevereCount: openItems.filter((item) => item.severity === "严重").length,
    teamOpenDI: Object.fromEntries(teamSummaries.map((item) => [item.team, item.openDI])),
    earlyRequirementCount: 0,
    cleanupNotClosedIterations: [],
    timelineMissingIterations: []
  });

  return {
    versionLine,
    total: items.length,
    open: openItems.length,
    closed: items.length - openItems.length,
    riskCount: new Set(risks.map((item) => item.itemId)).size,
    totalDI: Number(items.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    openDI: Number(openItems.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    statusCounts,
    severityCounts,
    teamSummaries,
    releaseGate,
    items
  };
}

export function summarizeTimelineCoverage(requirements: Requirement[], timelines: IterationTimeline[]) {
  const timelineKeys = new Set(timelines.map((item) => getTimelineKey(item)));
  return groupRequirementsByIteration(requirements)
    .map((group) => group.key)
    .filter((key) => !timelineKeys.has(key));
}

export function buildOwnerFollowupSummary(requirementRisks: RequirementRisk[], issueRisks: IssueRisk[]): OwnerFollowupSummary {
  const requirementOwners = [...new Set(requirementRisks.map((item) => item.owner).filter(Boolean))]
    .map((owner) => {
      const items = requirementRisks.filter((item) => item.owner === owner);
      return {
        owner,
        riskRequirementCount: new Set(items.map((item) => item.itemId)).size,
        iterations: [...new Set(items.map((item) => item.fullVersion))],
        stageDistribution: items.reduce<Record<string, number>>((acc, item) => {
          acc[item.stage] = (acc[item.stage] ?? 0) + 1;
          return acc;
        }, {}),
        topItems: items
      };
    })
    .sort((a, b) => b.riskRequirementCount - a.riskRequirementCount || a.owner.localeCompare(b.owner, "zh-CN"));

  const issueOwners = [...new Set(issueRisks.map((item) => item.owner).filter(Boolean))]
    .map((owner) => {
      const items = issueRisks.filter((item) => item.owner === owner);
      const openItems = items.filter((item) => item.status !== "关闭");
      return {
        owner,
        issueCount: new Set(items.map((item) => item.itemId)).size,
        openIssueCount: new Set(openItems.map((item) => item.itemId)).size,
        openDI: Number(openItems.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
        teams: [...new Set(items.map((item) => item.team).filter(Boolean))],
        items
      };
    })
    .sort((a, b) => b.openDI - a.openDI || b.openIssueCount - a.openIssueCount || a.owner.localeCompare(b.owner, "zh-CN"));

  return { requirementOwners, issueOwners };
}

export function checkMajorVersionReleaseGate(summary: ReleaseGateSummary) {
  const reasons: string[] = [];
  if (summary.openCriticalCount > 0) reasons.push("存在致命未关闭问题单");
  if (summary.openSevereCount > 3) reasons.push("严重未关闭问题单超过阈值(>3)");
  if (summary.openDI > 8) reasons.push("未关闭问题单总 DI 超过阈值(>8)");
  const teamBlockers = Object.entries(summary.teamOpenDI).filter(([, openDI]) => openDI > 5);
  if (teamBlockers.length) reasons.push(`关键团队未关闭问题单 DI 超阈值: ${teamBlockers.map(([team, di]) => `${team}(${di})`).join("、")}`);
  if (summary.earlyRequirementCount > 0) reasons.push("存在仍停留在前期阶段且影响发布的需求");
  if (summary.cleanupNotClosedIterations.length > 0) reasons.push(`存在问题单清理阶段仍未收口的小迭代: ${summary.cleanupNotClosedIterations.join("、")}`);
  if (summary.timelineMissingIterations.length > 0) reasons.push(`存在未维护时间轴的小迭代: ${summary.timelineMissingIterations.join("、")}`);

  return {
    passed: reasons.length === 0,
    reasons,
    metrics: {
      totalDI: summary.totalDI,
      openDI: summary.openDI
    }
  };
}
