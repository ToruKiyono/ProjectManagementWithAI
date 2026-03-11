import type { HealthLevel } from "../../models/risk";
import type { VersionSummary } from "../../models/summary";

export function computeVersionHealth(summary: Pick<VersionSummary, "highRiskCount" | "mediumRiskCount" | "lowRiskCount" | "openIssues" | "laggingRequirementCount" | "stageDistribution">): { score: number; level: HealthLevel } {
  let score = 100;
  score -= summary.highRiskCount * 15;
  score -= summary.mediumRiskCount * 8;
  score -= summary.lowRiskCount * 3;
  score -= summary.openIssues * 2;
  score -= summary.laggingRequirementCount * 10;
  if (((summary.stageDistribution["问题单清理"] || 0) + (summary.stageDistribution["需求上线"] || 0)) > 0 && summary.openIssues > 0) score -= 20;
  score = Math.max(0, score);
  let level: HealthLevel = "阻塞";
  if (score >= 90) level = "健康";
  else if (score >= 70) level = "关注";
  else if (score >= 40) level = "风险";
  return { score, level };
}

export const computeHealthScore = computeVersionHealth;
