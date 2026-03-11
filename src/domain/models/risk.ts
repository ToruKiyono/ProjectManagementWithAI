export type RiskLevel = "高" | "中" | "低";

export type RiskRecord = {
  type: "需求风险" | "问题单风险" | "版本风险";
  id: string;
  itemId: string;
  title: string;
  level: RiskLevel;
  version: string;
  versionLine: string;
  releaseVersion: string;
  cycleVersion?: string;
  fullVersion: string;
  owner: string;
  sourceType: "requirement" | "issue" | "version";
  text: string;
  reason: string;
  requirementId?: string;
  issueId?: string;
};

export type HealthLevel = "健康" | "关注" | "风险" | "阻塞";

export type ReleaseGateResult = {
  passed: boolean;
  reasons: string[];
};
