export type AuditCategory = "requirement" | "issue" | "timeline" | "page" | "ai";

export type AuditLevel = "blocker" | "high" | "medium" | "low" | "info";

export type AuditSourceType =
  | "requirement"
  | "issue"
  | "timeline"
  | "recognition"
  | "mapping"
  | "transfer-risk"
  | "release-risk"
  | "followup"
  | "page";

export type SelfAuditFinding = {
  id: string;
  category: AuditCategory;
  level: AuditLevel;
  checkCode: string;
  title: string;
  message: string;
  itemId?: string;
  fileName?: string;
  versionKey?: string;
  expected?: string;
  actual?: string;
  suggestion: string;
  sourceType: AuditSourceType;
};

export type SelfAuditSummary = {
  totalChecks: number;
  blockerCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  infoCount: number;
};

export type SelfAuditReport = {
  summary: SelfAuditSummary;
  sections: Record<AuditCategory, SelfAuditFinding[]>;
  passed: boolean;
  topFindings: SelfAuditFinding[];
};

export type SelfAuditStatus =
  | "idle"
  | "validating_data"
  | "validating_page"
  | "validating_ai"
  | "building_report"
  | "success"
  | "partial_success"
  | "error";

export type SelfAuditScope = "all" | AuditCategory;

export type SelfAuditState = {
  enabled: boolean;
  status: SelfAuditStatus;
  currentStep: string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string;
  progressPercent: number;
  findingCount: number;
  report: SelfAuditReport | null;
  findings: SelfAuditFinding[];
  errors: string[];
};
