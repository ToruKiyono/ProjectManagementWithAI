import type { Issue } from "./issue";
import type { Requirement } from "./requirement";

export type AITableType = "requirement" | "issue" | "timeline" | "unknown";
export type AIRiskLevel = "高" | "中" | "低" | "无";
export type AIJobStatus =
  | "idle"
  | "preparing"
  | "recognizing"
  | "mapping"
  | "analyzing_transfer"
  | "analyzing_release"
  | "generating_followup"
  | "success"
  | "partial_success"
  | "error"
  | "timeout";

export type AIAnalysisScope =
  | "all_files"
  | "requirement_only"
  | "issue_only"
  | "timeline_only"
  | "current_iteration"
  | "current_major";

export type AIStep =
  | "prepare"
  | "recognize"
  | "mapping"
  | "transfer"
  | "release"
  | "followup"
  | "highlight";

export type AIConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  providerName: string;
  timeoutMs: number;
};

export type AIJsonResult<T> = {
  ok: boolean;
  data: T | null;
  error: string;
  provider: string;
};

export type AIFileParseCache = {
  fileName: string;
  rows: Array<Record<string, unknown>>;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
};

export type AIHighlightItem = {
  type: "requirement" | "issue" | "owner";
  id: string;
  title: string;
  level: AIRiskLevel;
};

export type TableRecognitionResult = {
  fileName: string;
  rowCount: number;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
  ruleType: AITableType;
  detectedType: AITableType;
  finalType: AITableType;
  confidence: number;
  reasoning: string;
  source: "rule" | "ai" | "mixed" | "manual";
  mapping: Record<string, string>;
  mappingConfidence: number;
  mappingReasoning: string;
  error?: string;
};

export type NotifyOwner = {
  name: string;
  role: string;
  sourceType: "requirement" | "issue" | "team";
  itemId: string;
  versionKey: string;
  reason: string;
  suggestedAction?: string;
};

export type TransferRiskAnalysis = {
  iterationKey: string;
  versionLine: string;
  releaseVersion: string;
  cycleVersion: string;
  riskLevel: AIRiskLevel;
  summary: string;
  reasons: string[];
  blockers: string[];
  suggestedActions: string[];
  notifyOwners: NotifyOwner[];
  highlightItems: AIHighlightItem[];
  confidence: number;
  source: "rule" | "ai" | "merged";
  relatedRequirementIds: string[];
  relatedIssueIds: string[];
  metrics: {
    requirementCount: number;
    earlyStageCount: number;
    transferReadyRate: number;
    openIssueCount: number;
    severeOpenIssueCount: number;
    explicitRiskCount: number;
  };
};

export type ReleaseRiskAnalysis = {
  versionLine: string;
  releaseVersion: string;
  riskLevel: AIRiskLevel;
  summary: string;
  reasons: string[];
  blockers: string[];
  suggestedActions: string[];
  notifyOwners: NotifyOwner[];
  highlightItems: AIHighlightItem[];
  confidence: number;
  source: "rule" | "ai" | "merged";
  totalDI: number;
  openDI: number;
  riskTeams: Array<{ team: string; openDI: number; openCount: number }>;
  blockingIssueIds: string[];
  relatedRequirementIds: string[];
};

export type FollowupSuggestion = NotifyOwner & {
  releaseVersion: string;
  versionLine: string;
};

export type HighlightedRequirementRisk = {
  id: string;
  title: string;
  iterationKey: string;
  stage: string;
  riskLevel: AIRiskLevel;
  objectiveReasons: string[];
  aiSummary: string;
  owner: string;
  tester: string;
  suggestedActions: string[];
};

export type HighlightedIssueRisk = {
  id: string;
  title: string;
  severity: string;
  di: number;
  status: string;
  stage: string;
  team: string;
  owner: string;
  tester: string;
  versionLine: string;
  releaseVersion: string;
  foundIteration: string;
  versionRelation: string;
  riskLevel: AIRiskLevel;
  objectiveReasons: string[];
  aiSummary: string;
  suggestedActions: string[];
};

export type HighlightedOwner = {
  name: string;
  role: string;
  bucket: "立即提醒" | "重点关注";
  versionKeys: string[];
  riskCount: number;
  highRiskCount: number;
  openIssueDI: number;
  relatedItemIds: string[];
  reasons: string[];
  suggestedActions: string[];
};

export type AIJob = {
  status: AIJobStatus;
  currentStep: AIStep | "";
  currentFileName: string;
  currentTableType: AITableType | "";
  startedAt: string;
  updatedAt: string;
  finishedAt: string;
  progressPercent: number;
  successCount: number;
  errorCount: number;
  warnings: string[];
  errors: string[];
  completed: boolean;
  lastScope: AIAnalysisScope;
};

export type TableTypeDetectionPayload = {
  fileName: string;
  headers: string[];
  sampleRows: Array<Record<string, unknown>>;
};

export type TableTypeDetectionResult = {
  tableType: AITableType;
  confidence: number;
  reasoning: string;
};

export type FieldMappingResult = {
  mapping: Record<string, string>;
  confidence: number;
  reasoning: string;
};

export type FileFieldMappingResult = FieldMappingResult & {
  fileName: string;
  tableType: AITableType;
};

export type TransferRiskAIPayload = {
  iterationKey: string;
  requirements: Requirement[];
  relatedIssues: Issue[];
  timelineNode: Record<string, unknown> | null;
  ruleSummary: Omit<TransferRiskAnalysis, "source" | "confidence">;
};

export type ReleaseRiskAIPayload = {
  versionLine: string;
  releaseVersion: string;
  requirements: Requirement[];
  issues: Issue[];
  timelines: Array<Record<string, unknown>>;
  ruleSummary: Omit<ReleaseRiskAnalysis, "source" | "confidence">;
};
