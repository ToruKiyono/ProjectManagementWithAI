import type { ReleaseGateResult } from "../../models/risk";
import type { VersionSummary } from "../../models/summary";

export type ReleaseGateOptions = {
  maxOpenIssues: number;
  maxMissingStageDates: number;
};

export function checkVersionReleaseGate(summary: Pick<VersionSummary, "preStageRequirementCount" | "openHighSeverityCount" | "openIssues" | "cleanupBlockedCount" | "missingCriticalStageDatesCount">, options: ReleaseGateOptions): ReleaseGateResult {
  const reasons: string[] = [];
  if (summary.preStageRequirementCount > 0) reasons.push(`仍有 ${summary.preStageRequirementCount} 条需求停留在前置阶段（基线/澄清/设计）。`);
  if (summary.openHighSeverityCount > 0) reasons.push(`仍有 ${summary.openHighSeverityCount} 个高严重度未关闭问题单。`);
  if (summary.openIssues > options.maxOpenIssues) reasons.push(`未关闭问题单 ${summary.openIssues} 个，超过阈值 ${options.maxOpenIssues}。`);
  if (summary.cleanupBlockedCount > 0) reasons.push(`有 ${summary.cleanupBlockedCount} 条“问题单清理”阶段需求仍绑定未关闭问题单。`);
  if (summary.missingCriticalStageDatesCount > options.maxMissingStageDates) reasons.push(`缺失关键阶段日期 ${summary.missingCriticalStageDatesCount} 项，超过阈值 ${options.maxMissingStageDates}。`);
  return { passed: reasons.length === 0, reasons };
}
