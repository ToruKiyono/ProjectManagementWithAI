import type { Issue } from "../../models/issue";
import { issueSeverities, issueStatuses } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import { requirementStages } from "../../models/requirement";
import type { VersionSummary } from "../../models/summary";
import { countBy } from "../../../utils/helpers";
import type { RiskRecord } from "../../models/risk";
import { computeVersionHealth } from "./computeVersionHealth";
import { checkVersionReleaseGate, type ReleaseGateOptions } from "./checkVersionReleaseGate";
import { parseVersion, formatVersionScopeLabel } from "../normalize/parseVersionInfo";
import { isIssueOpen, isRequirementBehindSchedule } from "./collectRisks";

function buildOwnersTop(requirements: Requirement[], issues: Issue[]) {
  const counts: Record<string, number> = {};
  requirements.forEach((requirement) => {
    if (requirement.owner) counts[requirement.owner] = (counts[requirement.owner] || 0) + 1;
  });
  issues.forEach((issue) => {
    if (issue.owner) counts[issue.owner] = (counts[issue.owner] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));
}

function buildOwnerList(values: string[]) {
  const counts: Record<string, number> = {};
  values.filter(Boolean).forEach((value) => {
    counts[value] = (counts[value] || 0) + 1;
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));
}

function getStageBucket(stage: string) {
  if (["需求基线", "需求澄清", "设计文档编写", "需求会签", "需求评审", "需求串讲"].includes(stage)) return "前置准备";
  if (stage === "需求开发") return "开发中";
  if (stage === "需求转测") return "转测中";
  if (stage === "问题单清理") return "清理中";
  if (stage === "需求上线") return "已上线";
  return "其他";
}

function countMissingCriticalStageDates(requirements: Requirement[]) {
  const criticalStages = ["需求开发", "需求转测", "问题单清理", "需求上线"];
  let count = 0;
  requirements.forEach((requirement) => {
    criticalStages.forEach((stage) => {
      if (!requirement.stageDates[stage]) count += 1;
    });
  });
  return count;
}

export function buildVersionSummary(
  scopeLevel: VersionSummary["scopeLevel"],
  version: string,
  requirements: Requirement[],
  issues: Issue[],
  risks: RiskRecord[],
  options: ReleaseGateOptions
): VersionSummary {
  const versionInfo = scopeLevel === "ALL" ? parseVersion("", "") : parseVersion(version, "");
  const issuesByReq = new Map<string, Issue[]>();
  issues.forEach((issue) => {
    const list = issuesByReq.get(issue.requirementId) || [];
    list.push(issue);
    issuesByReq.set(issue.requirementId, list);
  });

  const summaryBase = {
    scopeLevel,
    version,
    versionLabel: formatVersionScopeLabel(scopeLevel, version),
    versionLine: versionInfo.versionLine,
    versionLineKey: versionInfo.versionLine,
    releaseVersion: versionInfo.releaseVersion,
    cycleVersion: versionInfo.cycleVersion,
    patchVersion: versionInfo.patchVersion,
    releaseKey: versionInfo.releaseKey,
    cycleKey: versionInfo.cycleKey,
    versionKey: versionInfo.versionKey,
    versionScene: versionInfo.versionScene,
    majorVersion: versionInfo.majorVersion,
    majorVersionKey: versionInfo.majorVersionKey,
    minorIteration: versionInfo.minorIteration,
    fullVersion: versionInfo.fullVersion,
    requirements,
    issues,
    risks,
    totalRequirements: requirements.length,
    completedRequirements: requirements.filter((requirement) => requirement.stage === "需求上线" || requirement.progressPercent >= 100 || ["已完成", "关闭", "已上线"].includes(requirement.status)).length,
    inProgressRequirements: requirements.filter((requirement) => !["需求上线"].includes(requirement.stage) && requirement.progressPercent < 100).length,
    riskRequirementCount: new Set(risks.filter((risk) => risk.sourceType === "requirement").map((risk) => risk.itemId)).size,
    requirementProgress: requirements.length ? Math.round(requirements.reduce((sum, requirement) => sum + requirement.progressPercent, 0) / requirements.length) : 0,
    onlineRequirements: requirements.filter((requirement) => requirement.stage === "需求上线").length,
    totalIssues: issues.length,
    openIssues: issues.filter(isIssueOpen).length,
    riskIssueCount: new Set(risks.filter((risk) => risk.sourceType === "issue").map((risk) => risk.itemId)).size,
    highRiskCount: risks.filter((risk) => risk.level === "高").length,
    mediumRiskCount: risks.filter((risk) => risk.level === "中").length,
    lowRiskCount: risks.filter((risk) => risk.level === "低").length,
    stageDistribution: countBy(requirements, (requirement) => requirement.stage, [...requirementStages]),
    stageBucketDistribution: countBy(requirements, (requirement) => getStageBucket(requirement.stage), ["前置准备", "开发中", "转测中", "清理中", "已上线"]),
    issueStatusDistribution: countBy(issues, (issue) => issue.status, [...issueStatuses]),
    severityDistribution: countBy(issues, (issue) => issue.severity, [...issueSeverities]),
    ownersTop: buildOwnersTop(requirements, issues),
    riskOwnersTop: buildOwnerList(risks.map((risk) => risk.owner)),
    issueOwnersTop: buildOwnerList(issues.map((issue) => issue.owner || issue.devOwner || issue.tester)),
    laggingRequirementCount: requirements.filter((requirement) => isRequirementBehindSchedule(requirement).lagging).length,
    cleanupBlockedCount: requirements.filter((requirement) => requirement.stage === "问题单清理" && (issuesByReq.get(requirement.id) || []).some(isIssueOpen)).length,
    cleanupBoundCount: requirements.filter((requirement) => requirement.stage === "问题单清理" && (issuesByReq.get(requirement.id) || []).length > 0).length,
    openHighSeverityCount: issues.filter((issue) => isIssueOpen(issue) && ["紧急", "高"].includes(issue.severity)).length,
    missingCriticalStageDatesCount: countMissingCriticalStageDates(requirements),
    preStageRequirementCount: requirements.filter((requirement) => ["需求基线", "需求澄清", "设计文档编写"].includes(requirement.stage)).length,
    legacyIssueCount: issues.filter((issue) => issue.isLegacyIssue).length,
    legacyHighRiskIssueCount: issues.filter((issue) => issue.isLegacyIssue && isIssueOpen(issue) && ["紧急", "高"].includes(issue.severity)).length,
    topRisks: risks.slice(0, 10)
  };

  const health = computeVersionHealth(summaryBase);
  const releaseGate = checkVersionReleaseGate(summaryBase, options);

  return {
    ...summaryBase,
    healthScore: health.score,
    healthLevel: health.level,
    releaseGate
  };
}
