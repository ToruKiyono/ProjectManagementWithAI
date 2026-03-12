import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type {
  AIAnalysisScope,
  AIConfig,
  AIFileParseCache,
  AIJob,
  AIJobStatus,
  AIStep,
  AITableType,
  FileFieldMappingResult,
  FollowupSuggestion,
  HighlightedIssueRisk,
  HighlightedOwner,
  HighlightedRequirementRisk,
  ReleaseRiskAnalysis,
  TableRecognitionResult,
  TransferRiskAnalysis
} from "../domain/models/ai";
import type { SelfAuditScope, SelfAuditState } from "../domain/models/audit";
import type { Issue } from "../domain/models/issue";
import type { IterationTimeline } from "../domain/models/iterationTimeline";
import type { Requirement } from "../domain/models/requirement";
import type { TeamIssueSummary } from "../domain/services/compute/management";
import {
  buildOwnerFollowupSummary,
  checkMajorVersionReleaseGate,
  computeIssueVersionRelation,
  detectIssueRisks,
  detectRequirementRisks,
  groupIssuesByMajorVersion,
  groupRequirementsByIteration,
  summarizeIteration,
  summarizeMajorVersionIssues,
  summarizeTeamDI,
  summarizeTimelineCoverage
} from "../domain/services/compute/management";
import {
  buildFollowupSuggestions,
  buildReleaseRiskAnalysis,
  buildTransferRiskAnalysis,
  generateFollowupAdviceWithAI
} from "../domain/services/ai/riskAnalysis";
import { getDefaultAIConfig } from "../domain/services/ai/provider";
import {
  inferFieldMappingWithAI,
  normalizeIssueWithMapping,
  normalizeRequirementWithMapping,
  normalizeTimelineWithMapping,
  parseUploadedWorkbook,
  recognizeTable
} from "../domain/services/ai/tableIntelligence";
import { buildSelfAuditReport, extractUntrustedItemIds, runSelfAudit } from "../domain/services/audit/selfAudit";
import { mapHuaweiIssue } from "../domain/services/normalize/mapHuaweiIssue";
import { normalizeIterationTimeline } from "../domain/services/normalize/normalizeIterationTimeline";
import { normalizeIssue } from "../domain/services/normalize/normalizeIssue";
import { normalizeRequirement } from "../domain/services/normalize/normalizeRequirement";
import { mergeVersionInfo } from "../domain/services/normalize/parseVersionInfo";
import { syncApi } from "../domain/services/sync/syncApi";
import { syncCombined } from "../domain/services/sync/syncCombined";
import { syncHuaweiIssues } from "../domain/services/sync/syncHuaweiIssues";
import { seedIssues, seedIterationTimelines, seedRequirements } from "../seed/seedData";

type SyncMeta = { source: string; updatedAt: string };
type Snapshot = { requirements: Requirement[]; issues: Issue[]; timelines: IterationTimeline[] };
type PaginationState = { reqPage: number; issuePage: number; pageSize: number };
type Filters = { versionLine: string; releaseVersion: string; iteration: string };

type WorkflowOptions = {
  scope?: AIAnalysisScope;
  steps?: AIStep[];
  files?: File[];
  manualTypes?: Record<string, AITableType>;
};

const ALL_STEPS: AIStep[] = ["prepare", "recognize", "mapping", "transfer", "release", "followup", "highlight"];

const EMPTY_AI_JOB: AIJob = {
  status: "idle",
  currentStep: "",
  currentFileName: "",
  currentTableType: "",
  startedAt: "",
  updatedAt: "",
  finishedAt: "",
  progressPercent: 0,
  successCount: 0,
  errorCount: 0,
  warnings: [],
  errors: [],
  completed: false,
  lastScope: "all_files"
};

const EMPTY_SELF_AUDIT: SelfAuditState = {
  enabled: true,
  status: "idle",
  currentStep: "",
  startedAt: "",
  updatedAt: "",
  finishedAt: "",
  progressPercent: 0,
  findingCount: 0,
  report: null,
  findings: [],
  errors: []
};

export type ProjectState = {
  current: Snapshot;
  previous: Snapshot | null;
  filters: Filters;
  pagination: PaginationState;
  syncMeta: SyncMeta;
  loading: boolean;
  error: string;
  aiConfig: AIConfig;
  aiJob: AIJob;
  aiRecognitionResults: TableRecognitionResult[];
  aiFieldMappings: FileFieldMappingResult[];
  aiTransferRiskResults: TransferRiskAnalysis[];
  aiReleaseRiskResults: ReleaseRiskAnalysis[];
  aiFollowupSuggestions: FollowupSuggestion[];
  highlightedRequirementRisks: HighlightedRequirementRisk[];
  highlightedIssueRisks: HighlightedIssueRisk[];
  highlightedOwners: HighlightedOwner[];
  selfAudit: SelfAuditState;
  aiLoading: boolean;
  aiErrors: string[];
  uploadedTables: AIFileParseCache[];
  setVersionLineFilter: (value: string) => void;
  setReleaseVersionFilter: (value: string) => void;
  setIterationFilter: (value: string) => void;
  clearFilters: () => void;
  setReqPage: (page: number) => void;
  setIssuePage: (page: number) => void;
  setAIConfig: (patch: Partial<AIConfig>) => void;
  importTableData: (requirementsInput: Record<string, unknown>[], issuesInput: Record<string, unknown>[], timelineInput?: Record<string, unknown>[], source?: string) => void;
  importFilesWithAI: (files: File[], manualTypes?: Record<string, AITableType>) => Promise<void>;
  overrideRecognition: (fileName: string, tableType: AITableType) => Promise<void>;
  rerunAIAnalysis: (options?: WorkflowOptions) => Promise<void>;
  retryAIStep: (step: AIStep, scope?: AIAnalysisScope) => Promise<void>;
  syncFromApis: (requirementUrl: string, issueUrl: string) => Promise<void>;
  syncFromCombined: (url: string) => Promise<void>;
  syncHuawei: (url: string) => Promise<void>;
  loadSeed: () => void;
  clearError: () => void;
  clearAIErrors: () => void;
  setSelfAuditEnabled: (enabled: boolean) => void;
  triggerSelfAudit: () => Promise<void>;
  triggerPartialAudit: (scope: SelfAuditScope) => Promise<void>;
  clearSelfAuditResult: () => void;
  exportCurrentJson: () => string;
};

function nowString() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function extractRequirementsFromResponse(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  return (obj.requirements || (obj.data as Record<string, unknown>)?.requirements || obj.data || []) as Record<string, unknown>[];
}

function extractIssuesFromResponse(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];
  const obj = payload as Record<string, unknown>;
  return (obj.issues || (obj.data as Record<string, unknown>)?.result || (obj.data as Record<string, unknown>)?.issues || obj.data || []) as Record<string, unknown>[];
}

function linkIssues(requirements: Requirement[], issues: Issue[]) {
  const requirementVersionMap = new Map(requirements.map((item) => [item.id, item]));
  return issues.map((item) => {
    const requirement = requirementVersionMap.get(item.requirementId);
    return requirement ? { ...item, ...mergeVersionInfo(item, requirement) } : item;
  });
}

function normalizeSnapshots(requirementsInput: Record<string, unknown>[], issuesInput: Record<string, unknown>[], timelineInput: Record<string, unknown>[] = []): Snapshot {
  const requirements = requirementsInput.map((item, index) => normalizeRequirement(item, index));
  const timelines = timelineInput.map((item, index) => normalizeIterationTimeline(item, index));
  const issues = linkIssues(requirements, issuesInput.map((item, index) => normalizeIssue(item, index)));
  return { requirements, issues, timelines };
}

function buildSnapshot(requirements: Requirement[], issues: Issue[], timelines: IterationTimeline[]): Snapshot {
  return { requirements, issues: linkIssues(requirements, issues), timelines };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
}

function paginate<T>(list: T[], page: number, pageSize: number) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const start = (safePage - 1) * pageSize;
  return { page: safePage, total, totalPages, items: list.slice(start, start + pageSize) };
}

function filterRequirements(requirements: Requirement[], filters: Filters) {
  return requirements.filter((item) => {
    if (filters.versionLine !== "全部" && item.versionLine !== filters.versionLine) return false;
    if (filters.releaseVersion !== "全部" && item.releaseVersion !== filters.releaseVersion) return false;
    if (filters.iteration !== "全部" && item.fullVersion !== filters.iteration) return false;
    return true;
  });
}

function filterIssues(issues: Issue[], filters: Filters, scopedRequirementIds: Set<string>) {
  return issues.filter((item) => {
    if (filters.versionLine !== "全部" && item.versionLine !== filters.versionLine && !scopedRequirementIds.has(item.requirementId)) return false;
    if (filters.releaseVersion !== "全部" && item.releaseVersion !== filters.releaseVersion && !scopedRequirementIds.has(item.requirementId)) return false;
    if (filters.iteration !== "全部" && item.fullVersion !== filters.iteration && item.foundIteration !== filters.iteration && !scopedRequirementIds.has(item.requirementId)) return false;
    return true;
  });
}

function filterTimelines(timelines: IterationTimeline[], filters: Filters) {
  return timelines.filter((item) => {
    if (filters.versionLine !== "全部" && item.versionLine !== filters.versionLine) return false;
    if (filters.releaseVersion !== "全部" && item.releaseVersion !== filters.releaseVersion) return false;
    if (filters.iteration !== "全部" && item.fullVersion !== filters.iteration) return false;
    return true;
  });
}

function getPrimaryMajorVersion(majorSummaries: Array<{ versionLine: string }>, filters: Filters) {
  if (filters.versionLine !== "全部") return filters.versionLine;
  return majorSummaries[0]?.versionLine ?? "";
}

function computeMajorReleaseGate(versionLine: string, requirements: Requirement[], issues: Issue[], timelines: IterationTimeline[], teamSummaries: TeamIssueSummary[]) {
  const openIssues = issues.filter((item) => item.status !== "关闭");
  const earlyRequirements = requirements.filter((item) => ["需求基线", "需求澄清", "设计文档编写"].includes(item.stage));
  const cleanupNotClosedIterations = groupRequirementsByIteration(requirements)
    .map((group) => summarizeIteration(group, group.items, timelines))
    .filter((item) => item.stageDistribution["问题单清理"] > 0 && item.stageDistribution["需求上线"] === 0)
    .map((item) => item.fullVersion);
  const timelineMissingIterations = summarizeTimelineCoverage(requirements, timelines);

  return checkMajorVersionReleaseGate({
    versionLine,
    totalDI: Number(issues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    openDI: Number(openIssues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
    openCriticalCount: openIssues.filter((item) => item.severity === "致命").length,
    openSevereCount: openIssues.filter((item) => item.severity === "严重").length,
    teamOpenDI: Object.fromEntries(teamSummaries.map((item) => [item.team, item.openDI])),
    earlyRequirementCount: earlyRequirements.length,
    cleanupNotClosedIterations,
    timelineMissingIterations
  });
}

function stepToStatus(step: AIStep): AIJobStatus {
  return ({
    prepare: "preparing",
    recognize: "recognizing",
    mapping: "mapping",
    transfer: "analyzing_transfer",
    release: "analyzing_release",
    followup: "generating_followup",
    highlight: "generating_followup"
  } as const)[step];
}

function updateJobStep(job: AIJob, step: AIStep, patch?: Partial<AIJob>): AIJob {
  return {
    ...job,
    status: stepToStatus(step),
    currentStep: step,
    updatedAt: nowString(),
    ...patch
  };
}

function createInitialJob(scope: AIAnalysisScope): AIJob {
  const timestamp = nowString();
  return { ...EMPTY_AI_JOB, status: "preparing", currentStep: "prepare", startedAt: timestamp, updatedAt: timestamp, lastScope: scope };
}

function finalizeJob(job: AIJob): AIJob {
  const finishedAt = nowString();
  const hasErrors = job.errorCount > 0;
  const hasWarnings = job.warnings.length > 0;
  return {
    ...job,
    status: hasErrors ? (job.successCount > 0 || hasWarnings ? "partial_success" : "error") : hasWarnings ? "partial_success" : "success",
    updatedAt: finishedAt,
    finishedAt,
    progressPercent: 100,
    completed: true
  };
}

function getScopeTableTypes(scope: AIAnalysisScope): AITableType[] {
  if (scope === "requirement_only") return ["requirement"];
  if (scope === "issue_only") return ["issue"];
  if (scope === "timeline_only") return ["timeline"];
  return ["requirement", "issue", "timeline"];
}

function normalizeScopeRequirements(scope: AIAnalysisScope, snapshot: Snapshot, filters: Filters) {
  if (scope === "current_iteration" && filters.iteration !== "全部") return snapshot.requirements.filter((item) => item.fullVersion === filters.iteration);
  if (scope === "current_major" && filters.versionLine !== "全部") return snapshot.requirements.filter((item) => item.versionLine === filters.versionLine && (filters.releaseVersion === "全部" || item.releaseVersion === filters.releaseVersion));
  return snapshot.requirements;
}

function normalizeScopeIssues(scope: AIAnalysisScope, snapshot: Snapshot, filters: Filters) {
  if (scope === "current_iteration" && filters.iteration !== "全部") return snapshot.issues.filter((item) => item.foundIteration === filters.iteration || item.fullVersion === filters.iteration);
  if (scope === "current_major" && filters.versionLine !== "全部") return snapshot.issues.filter((item) => item.versionLine === filters.versionLine && (filters.releaseVersion === "全部" || item.releaseVersion === filters.releaseVersion || item.foundVersion === filters.releaseVersion));
  return snapshot.issues;
}

function normalizeScopeTimelines(scope: AIAnalysisScope, snapshot: Snapshot, filters: Filters) {
  if (scope === "current_iteration" && filters.iteration !== "全部") return snapshot.timelines.filter((item) => item.fullVersion === filters.iteration);
  if (scope === "current_major" && filters.versionLine !== "全部") return snapshot.timelines.filter((item) => item.versionLine === filters.versionLine && (filters.releaseVersion === "全部" || item.releaseVersion === filters.releaseVersion));
  return snapshot.timelines;
}

function buildSnapshotFromRecognition(base: Snapshot, uploadedTables: AIFileParseCache[], recognitionResults: TableRecognitionResult[]) {
  const tableMap = new Map(uploadedTables.map((item) => [item.fileName, item]));
  const grouped = {
    requirement: [] as Requirement[],
    issue: [] as Issue[],
    timeline: [] as IterationTimeline[]
  };

  recognitionResults.forEach((result) => {
    const table = tableMap.get(result.fileName);
    if (!table || result.finalType === "unknown") return;
    if (result.finalType === "requirement") grouped.requirement.push(...table.rows.map((row, index) => normalizeRequirementWithMapping(row, result.mapping, index)));
    if (result.finalType === "issue") grouped.issue.push(...table.rows.map((row, index) => normalizeIssueWithMapping(row, result.mapping, index)));
    if (result.finalType === "timeline") grouped.timeline.push(...table.rows.map((row, index) => normalizeTimelineWithMapping(row, result.mapping, index)));
  });

  return buildSnapshot(
    grouped.requirement.length ? grouped.requirement : base.requirements,
    grouped.issue.length ? grouped.issue : base.issues,
    grouped.timeline.length ? grouped.timeline : base.timelines
  );
}

function buildHighlightedRequirementRisks(snapshot: Snapshot, transferResults: TransferRiskAnalysis[]): HighlightedRequirementRisk[] {
  const riskMap = new Map<string, HighlightedRequirementRisk>();
  transferResults.forEach((result) => {
    snapshot.requirements.filter((item) => result.relatedRequirementIds.includes(item.id)).forEach((item) => {
      const previous = riskMap.get(item.id);
      riskMap.set(item.id, {
        id: item.id,
        title: item.title,
        iterationKey: item.fullVersion || item.releaseVersion,
        stage: item.stage,
        riskLevel: result.riskLevel,
        objectiveReasons: [...new Set([...(previous?.objectiveReasons ?? []), ...result.reasons])],
        aiSummary: result.summary,
        owner: item.owner,
        tester: item.tester,
        suggestedActions: [...new Set([...(previous?.suggestedActions ?? []), ...result.suggestedActions])]
      });
    });
  });
  return [...riskMap.values()]
    .filter((item) => item.riskLevel !== "无")
    .sort((a, b) => ["无", "低", "中", "高"].indexOf(b.riskLevel) - ["无", "低", "中", "高"].indexOf(a.riskLevel) || a.iterationKey.localeCompare(b.iterationKey, "zh-CN"));
}

function buildHighlightedIssueRisks(snapshot: Snapshot, releaseResults: ReleaseRiskAnalysis[]): HighlightedIssueRisk[] {
  const riskMap = new Map<string, HighlightedIssueRisk>();
  releaseResults.forEach((result) => {
    snapshot.issues.filter((item) => item.versionLine === result.versionLine || item.releaseVersion === result.releaseVersion || item.foundVersion === result.releaseVersion).forEach((issue) => {
      const previous = riskMap.get(issue.id);
      const riskLevel =
        issue.severity === "致命" && issue.status !== "关闭"
          ? "高"
          : issue.severity === "严重" && issue.status !== "关闭"
            ? "高"
            : result.reasons.some((item) => item.includes("超承诺")) && !!issue.dueDate
              ? "高"
              : result.reasons.some((item) => item.includes("老版本") || item.includes("未关联版本"))
                ? "中"
                : "低";
      riskMap.set(issue.id, {
        id: issue.id,
        title: issue.title,
        severity: issue.severity,
        di: issue.severityScore,
        status: issue.status,
        stage: issue.stage,
        team: issue.team,
        owner: issue.currentOwner || issue.owner,
        tester: issue.tester,
        versionLine: result.versionLine,
        releaseVersion: result.releaseVersion,
        foundIteration: issue.foundIteration || issue.fullVersion,
        versionRelation: issue.versionRelation,
        riskLevel,
        objectiveReasons: [...new Set([...(previous?.objectiveReasons ?? []), ...result.reasons])],
        aiSummary: result.summary,
        suggestedActions: [...new Set([...(previous?.suggestedActions ?? []), ...result.suggestedActions])]
      });
    });
  });
  return [...riskMap.values()]
    .filter((item) => item.riskLevel !== "无")
    .sort((a, b) => ["低", "中", "高"].indexOf(b.riskLevel) - ["低", "中", "高"].indexOf(a.riskLevel) || b.di - a.di);
}

function buildHighlightedOwners(followups: FollowupSuggestion[], highlightedIssues: HighlightedIssueRisk[], highlightedRequirements: HighlightedRequirementRisk[]): HighlightedOwner[] {
  const issueDIMap = new Map<string, number>();
  highlightedIssues.forEach((item) => {
    issueDIMap.set(item.owner, (issueDIMap.get(item.owner) ?? 0) + item.di);
    if (item.tester) issueDIMap.set(item.tester, (issueDIMap.get(item.tester) ?? 0) + item.di / 2);
  });

  const grouped = new Map<string, HighlightedOwner>();
  followups.forEach((item) => {
    const existing = grouped.get(item.name) ?? {
      name: item.name,
      role: item.role,
      bucket: "重点关注",
      versionKeys: [],
      riskCount: 0,
      highRiskCount: 0,
      openIssueDI: 0,
      relatedItemIds: [],
      reasons: [],
      suggestedActions: []
    };
    const highRiskHit =
      highlightedIssues.some((risk) => (risk.owner === item.name || risk.tester === item.name) && risk.riskLevel === "高") ||
      highlightedRequirements.some((risk) => (risk.owner === item.name || risk.tester === item.name) && risk.riskLevel === "高");
    existing.bucket = highRiskHit ? "立即提醒" : existing.bucket;
    existing.versionKeys = [...new Set([...existing.versionKeys, item.versionKey])];
    existing.riskCount += 1;
    existing.highRiskCount += highRiskHit ? 1 : 0;
    existing.openIssueDI = Number((issueDIMap.get(item.name) ?? 0).toFixed(1));
    existing.relatedItemIds = [...new Set([...existing.relatedItemIds, item.itemId])];
    existing.reasons = [...new Set([...existing.reasons, item.reason])];
    existing.suggestedActions = [...new Set([...existing.suggestedActions, item.suggestedAction || "尽快跟进处理"])];
    grouped.set(item.name, existing);
  });
  return [...grouped.values()].sort((a, b) => {
    if (a.bucket !== b.bucket) return a.bucket === "立即提醒" ? -1 : 1;
    if (b.highRiskCount !== a.highRiskCount) return b.highRiskCount - a.highRiskCount;
    if (b.openIssueDI !== a.openIssueDI) return b.openIssueDI - a.openIssueDI;
    if (b.riskCount !== a.riskCount) return b.riskCount - a.riskCount;
    return a.name.localeCompare(b.name, "zh-CN");
  });
}

export function selectDerived(state: ProjectState) {
  const { current, filters, pagination } = state;
  const safeCurrent = { requirements: current?.requirements ?? [], issues: current?.issues ?? [], timelines: current?.timelines ?? [] };
  const scopedRequirements = filterRequirements(safeCurrent.requirements, filters);
  const requirementIds = new Set(scopedRequirements.map((item) => item.id));
  const scopedIssues = filterIssues(safeCurrent.issues, filters, requirementIds).map((item) => ({
    ...item,
    versionRelation: computeIssueVersionRelation(item, {
      versionLine: filters.versionLine !== "全部" ? filters.versionLine : undefined,
      releaseVersion: filters.releaseVersion !== "全部" ? filters.releaseVersion : undefined
    })
  }));
  const scopedTimelines = filterTimelines(safeCurrent.timelines, filters);

  const requirementRisks = detectRequirementRisks(scopedRequirements, scopedTimelines);
  const issueRisks = detectIssueRisks(scopedIssues, {
    versionLine: filters.versionLine !== "全部" ? filters.versionLine : undefined,
    releaseVersion: filters.releaseVersion !== "全部" ? filters.releaseVersion : undefined
  });

  const iterationSummaries = groupRequirementsByIteration(scopedRequirements).map((group) => summarizeIteration(group, group.items, scopedTimelines));
  const teamSummaries = summarizeTeamDI(scopedIssues);
  const ownerFollowup = buildOwnerFollowupSummary(requirementRisks, issueRisks);

  const majorSummaries = groupIssuesByMajorVersion(scopedIssues).map(({ versionLine, items }) => {
    const requirementItems = scopedRequirements.filter((item) => item.versionLine === versionLine);
    const timelineItems = scopedTimelines.filter((item) => item.versionLine === versionLine);
    const summary = summarizeMajorVersionIssues(versionLine, items);
    const teamItems = teamSummaries.filter((item) => item.items.some((issue) => issue.versionLine === versionLine));
    return { ...summary, releaseGate: computeMajorReleaseGate(versionLine, requirementItems, items, timelineItems, teamItems) };
  });

  const primaryVersionLine = getPrimaryMajorVersion(majorSummaries, filters);
  const activeMajorSummary = majorSummaries.find((item) => item.versionLine === primaryVersionLine) ?? majorSummaries[0] ?? null;
  const releaseGateOverview = activeMajorSummary?.releaseGate ?? { passed: true, reasons: [], metrics: { totalDI: 0, openDI: 0 } };

  const versionLineOptions = uniqueSorted([...safeCurrent.requirements.map((item) => item.versionLine), ...safeCurrent.issues.map((item) => item.versionLine), ...safeCurrent.timelines.map((item) => item.versionLine)]);
  const releaseVersionOptions = uniqueSorted([...safeCurrent.requirements, ...safeCurrent.issues, ...safeCurrent.timelines].filter((item) => filters.versionLine === "全部" || item.versionLine === filters.versionLine).map((item) => item.releaseVersion));
  const iterationOptions = uniqueSorted([...safeCurrent.requirements, ...safeCurrent.timelines].filter((item) => (filters.versionLine === "全部" || item.versionLine === filters.versionLine) && (filters.releaseVersion === "全部" || item.releaseVersion === filters.releaseVersion)).map((item) => item.fullVersion));

  return {
    options: { versionLines: ["全部", ...versionLineOptions], releaseVersions: ["全部", ...releaseVersionOptions], iterations: ["全部", ...iterationOptions] },
    scopedRequirements,
    scopedIssues,
    scopedTimelines,
    requirementRisks,
    issueRisks,
    iterationSummaries,
    majorSummaries,
    teamSummaries,
    ownerFollowup,
    releaseGateOverview,
    topStats: {
      iterationCount: iterationSummaries.length,
      requirementCount: scopedRequirements.length,
      riskRequirementCount: new Set(requirementRisks.map((item) => item.itemId)).size,
      issueCount: scopedIssues.length,
      openIssueCount: scopedIssues.filter((item) => item.status !== "关闭").length,
      totalDI: Number(scopedIssues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
      openDI: Number(scopedIssues.filter((item) => item.status !== "关闭").reduce((sum, item) => sum + item.severityScore, 0).toFixed(1)),
      releaseGateStatus: activeMajorSummary ? (activeMajorSummary.releaseGate.passed ? "通过" : "阻塞") : "待判断"
    },
    requirementPage: paginate([...scopedRequirements].sort((a, b) => (a.fullVersion || "").localeCompare(b.fullVersion || "", "zh-CN") || a.id.localeCompare(b.id, "zh-CN")), pagination.reqPage, pagination.pageSize),
    issuePage: paginate([...scopedIssues].sort((a, b) => (a.versionLine || "").localeCompare(b.versionLine || "", "zh-CN") || a.id.localeCompare(b.id, "zh-CN")), pagination.issuePage, pagination.pageSize)
  };
}

async function executeSelfAudit(
  getState: () => ProjectState,
  setState: (next: Partial<ProjectState> | ((state: ProjectState) => Partial<ProjectState>)) => void,
  scope: SelfAuditScope = "all"
) {
  const state = getState();
  const startedAt = nowString();
  const scopeSet = scope === "all" ? new Set(["requirement", "issue", "timeline", "page", "ai"]) : new Set([scope]);

  setState({
    selfAudit: {
      ...state.selfAudit,
      status: "validating_data",
      currentStep: scope === "all" ? "validating all scopes" : `validating ${scope}`,
      startedAt,
      updatedAt: startedAt,
      finishedAt: "",
      progressPercent: 10,
      findingCount: 0,
      errors: []
    }
  });

  try {
    const latest = getState();
    const derived = selectDerived(latest);
    setState((current) => ({
      selfAudit: {
        ...current.selfAudit,
        status: scopeSet.has("page") ? "validating_page" : "validating_data",
        currentStep: scopeSet.has("page") ? "validating page view models" : "validating parsed data",
        updatedAt: nowString(),
        progressPercent: scopeSet.has("page") ? 55 : 35
      }
    }));
    setState((current) => ({
      selfAudit: {
        ...current.selfAudit,
        status: scopeSet.has("ai") ? "validating_ai" : current.selfAudit.status,
        currentStep: scopeSet.has("ai") ? "validating ai results" : current.selfAudit.currentStep,
        updatedAt: nowString(),
        progressPercent: scopeSet.has("ai") ? 75 : current.selfAudit.progressPercent
      }
    }));

    const auditResult = runSelfAudit({
      requirements: latest.current.requirements,
      issues: latest.current.issues,
      timelines: latest.current.timelines,
      derived,
      recognitionResults: latest.aiRecognitionResults,
      fieldMappings: latest.aiFieldMappings,
      transferResults: latest.aiTransferRiskResults,
      releaseResults: latest.aiReleaseRiskResults,
      followups: latest.aiFollowupSuggestions,
      highlightedRequirementRisks: latest.highlightedRequirementRisks,
      highlightedIssueRisks: latest.highlightedIssueRisks,
      highlightedOwners: latest.highlightedOwners,
      currentContext: latest.filters
    });

    const findings =
      scope === "all" ? auditResult.findings : auditResult.findings.filter((item) => item.category === scope);
    const report = scope === "all" ? auditResult.report : buildSelfAuditReport(findings);

    setState((current) => ({
      selfAudit: {
        ...current.selfAudit,
        status: "building_report",
        currentStep: "building audit report",
        updatedAt: nowString(),
        progressPercent: 90,
        findingCount: findings.length
      }
    }));

    const finishedAt = nowString();
    setState((current) => ({
      selfAudit: {
        ...current.selfAudit,
        status: findings.some((item) => item.level === "blocker" || item.level === "high")
          ? "partial_success"
          : "success",
        currentStep: "completed",
        updatedAt: finishedAt,
        finishedAt,
        progressPercent: 100,
        findingCount: findings.length,
        findings,
        report,
        errors: []
      }
    }));

    return extractUntrustedItemIds(findings);
  } catch (error) {
    const finishedAt = nowString();
    setState((current) => ({
      selfAudit: {
        ...current.selfAudit,
        status: "error",
        currentStep: "failed",
        updatedAt: finishedAt,
        finishedAt,
        progressPercent: 100,
        errors: [error instanceof Error ? error.message : "audit failed"]
      }
    }));
    return extractUntrustedItemIds([]);
  }
}

async function executeWorkflow(getState: () => ProjectState, setState: (next: Partial<ProjectState> | ((state: ProjectState) => Partial<ProjectState>)) => void, options: WorkflowOptions = {}) {
  const state = getState();
  const scope = options.scope ?? "all_files";
  const steps = options.steps?.length ? options.steps : ALL_STEPS;
  let aiJob = createInitialJob(scope);
  let uploadedTables = options.files ? [] : state.uploadedTables;
  let recognitionResults = state.aiRecognitionResults;
  let fieldMappings = state.aiFieldMappings;
  let snapshot = state.current;
  let transferResults = state.aiTransferRiskResults;
  let releaseResults = state.aiReleaseRiskResults;
  let followups = state.aiFollowupSuggestions;
  const warnings: string[] = [];

  setState({ aiLoading: true, aiErrors: [], aiJob });

  const progress = (step: AIStep, patch?: Partial<AIJob>) => {
    aiJob = updateJobStep(aiJob, step, patch);
    aiJob.progressPercent = Math.round(((steps.indexOf(step) + 1) / steps.length) * 100);
    setState({ aiJob, aiLoading: true });
  };

  try {
    if (steps.includes("prepare") && options.files?.length) {
      for (const file of options.files) {
        progress("prepare", { currentFileName: file.name, currentTableType: "" });
        uploadedTables.push(await parseUploadedWorkbook(file));
        aiJob.successCount += 1;
        setState({ aiJob, uploadedTables });
      }
    }

    if (steps.includes("recognize") && uploadedTables.length) {
      const scopedTypes = getScopeTableTypes(scope);
      const manualTypes = options.manualTypes ?? Object.fromEntries(recognitionResults.map((item) => [item.fileName, item.finalType])) as Record<string, AITableType>;
      const nextRecognition: TableRecognitionResult[] = [];
      for (const table of uploadedTables) {
        const existing = recognitionResults.find((item) => item.fileName === table.fileName);
        if (existing && !options.files && !scopedTypes.includes(existing.finalType)) {
          nextRecognition.push(existing);
          continue;
        }
        progress("recognize", { currentFileName: table.fileName, currentTableType: existing?.finalType ?? "" });
        try {
          const result = await recognizeTable(table, getState().aiConfig, manualTypes[table.fileName]);
          nextRecognition.push(result);
          aiJob.successCount += 1;
        } catch (error) {
          aiJob.errorCount += 1;
          aiJob.errors = [...aiJob.errors, `识别失败: ${table.fileName} / ${error instanceof Error ? error.message : "未知错误"}`];
        }
        setState({ aiJob });
      }
      recognitionResults = nextRecognition.length ? nextRecognition : recognitionResults;
      setState({ aiRecognitionResults: recognitionResults });
    }

    if (steps.includes("mapping") && uploadedTables.length) {
      const scopedTypes = getScopeTableTypes(scope);
      const nextMappings: FileFieldMappingResult[] = [];
      for (const table of uploadedTables) {
        const recognition = recognitionResults.find((item) => item.fileName === table.fileName);
        if (!recognition) continue;
        const existing = fieldMappings.find((item) => item.fileName === table.fileName);
        if (existing && !options.files && !scopedTypes.includes(recognition.finalType)) {
          nextMappings.push(existing);
          continue;
        }
        progress("mapping", { currentFileName: table.fileName, currentTableType: recognition.finalType });
        try {
          const mapping = await inferFieldMappingWithAI(recognition.finalType, table.headers, table.sampleRows, getState().aiConfig);
          recognition.mapping = mapping.mapping;
          recognition.mappingConfidence = mapping.confidence;
          recognition.mappingReasoning = mapping.reasoning;
          nextMappings.push({ fileName: table.fileName, tableType: recognition.finalType, ...mapping });
          aiJob.successCount += 1;
        } catch (error) {
          aiJob.errorCount += 1;
          aiJob.errors = [...aiJob.errors, `字段映射失败: ${table.fileName} / ${error instanceof Error ? error.message : "未知错误"}`];
        }
        setState({ aiJob });
      }
      fieldMappings = nextMappings.length ? nextMappings : fieldMappings;
      snapshot = buildSnapshotFromRecognition(getState().current, uploadedTables, recognitionResults);
      setState({ aiFieldMappings: fieldMappings, aiRecognitionResults: recognitionResults, current: snapshot, uploadedTables });
    }

    const scopedRequirements = normalizeScopeRequirements(scope, snapshot, getState().filters);
    const scopedIssues = normalizeScopeIssues(scope, snapshot, getState().filters);
    const scopedTimelines = normalizeScopeTimelines(scope, snapshot, getState().filters);

    if (steps.includes("transfer")) {
      progress("transfer", { currentFileName: "", currentTableType: "requirement" });
      try {
        const results = await buildTransferRiskAnalysis(scopedRequirements, scopedIssues, scopedTimelines, getState().aiConfig);
        transferResults = scope === "all_files" ? results : [...state.aiTransferRiskResults.filter((item) => !results.some((next) => next.iterationKey === item.iterationKey)), ...results];
        setState({ aiTransferRiskResults: transferResults });
        aiJob.successCount += 1;
        if (results.every((item) => item.source === "rule")) warnings.push("转测风险分析未获得 AI 返回，已降级为规则分析结果");
      } catch (error) {
        aiJob.errorCount += 1;
        aiJob.errors = [...aiJob.errors, `转测风险分析失败: ${error instanceof Error ? error.message : "未知错误"}`];
      }
      setState({ aiJob });
    }

    if (steps.includes("release")) {
      progress("release", { currentFileName: "", currentTableType: "issue" });
      try {
        const results = await buildReleaseRiskAnalysis(scopedRequirements, scopedIssues, scopedTimelines, getState().aiConfig);
        releaseResults = scope === "all_files" ? results : [...state.aiReleaseRiskResults.filter((item) => !results.some((next) => next.versionLine === item.versionLine && next.releaseVersion === item.releaseVersion)), ...results];
        setState({ aiReleaseRiskResults: releaseResults });
        aiJob.successCount += 1;
        if (results.every((item) => item.source === "rule")) warnings.push("上线风险分析未获得 AI 返回，已降级为规则分析结果");
      } catch (error) {
        aiJob.errorCount += 1;
        aiJob.errors = [...aiJob.errors, `上线风险分析失败: ${error instanceof Error ? error.message : "未知错误"}`];
      }
      setState({ aiJob });
    }

    if (steps.includes("followup")) {
      progress("followup", { currentFileName: "", currentTableType: "" });
      try {
        followups = buildFollowupSuggestions(transferResults, releaseResults);
        const aiFollowups = await generateFollowupAdviceWithAI({ transfer: transferResults, release: releaseResults }, getState().aiConfig);
        if (aiFollowups?.length) {
          followups = buildFollowupSuggestions(
            transferResults.map((item) => ({ ...item, notifyOwners: [...item.notifyOwners, ...aiFollowups] })),
            releaseResults
          );
        } else {
          warnings.push("提醒对象未获得 AI 增强，已使用规则与现有分析结果");
        }
        setState({ aiFollowupSuggestions: followups });
        aiJob.successCount += 1;
      } catch (error) {
        aiJob.errorCount += 1;
        aiJob.errors = [...aiJob.errors, `提醒对象生成失败: ${error instanceof Error ? error.message : "未知错误"}`];
      }
      setState({ aiJob });
    }

    if (steps.includes("highlight")) {
      progress("highlight", { currentFileName: "", currentTableType: "" });
      const highlightedRequirementRisks = buildHighlightedRequirementRisks(snapshot, transferResults);
      const highlightedIssueRisks = buildHighlightedIssueRisks(snapshot, releaseResults);
      const highlightedOwners = buildHighlightedOwners(followups, highlightedIssueRisks, highlightedRequirementRisks);
      setState({ highlightedRequirementRisks, highlightedIssueRisks, highlightedOwners });
      aiJob.successCount += 1;
    }

    aiJob.warnings = warnings;
    setState({ aiJob: finalizeJob(aiJob), aiLoading: false, aiErrors: aiJob.errors });
    if (getState().selfAudit.enabled) {
      await executeSelfAudit(getState, setState, "all");
    }
  } catch (error) {
    aiJob.errorCount += 1;
    aiJob.errors = [...aiJob.errors, error instanceof Error ? error.message : "未知错误"];
    aiJob.status = error instanceof Error && error.name === "AbortError" ? "timeout" : "error";
    aiJob.updatedAt = nowString();
    aiJob.finishedAt = aiJob.updatedAt;
    aiJob.completed = true;
    setState({ aiJob, aiLoading: false, aiErrors: aiJob.errors });
  }
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      current: normalizeSnapshots(seedRequirements, seedIssues, seedIterationTimelines),
      previous: null,
      filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
      pagination: { reqPage: 1, issuePage: 1, pageSize: 50 },
      syncMeta: { source: "演示数据", updatedAt: nowString() },
      loading: false,
      error: "",
      aiConfig: getDefaultAIConfig(),
      aiJob: EMPTY_AI_JOB,
      aiRecognitionResults: [],
      aiFieldMappings: [],
      aiTransferRiskResults: [],
      aiReleaseRiskResults: [],
      aiFollowupSuggestions: [],
      highlightedRequirementRisks: [],
      highlightedIssueRisks: [],
      highlightedOwners: [],
      selfAudit: EMPTY_SELF_AUDIT,
      aiLoading: false,
      aiErrors: [],
      uploadedTables: [],
      setVersionLineFilter: (value) => set((state) => ({ filters: { versionLine: value, releaseVersion: "全部", iteration: "全部" }, pagination: { ...state.pagination, reqPage: 1, issuePage: 1 } })),
      setReleaseVersionFilter: (value) => set((state) => ({ filters: { ...state.filters, releaseVersion: value, iteration: "全部" }, pagination: { ...state.pagination, reqPage: 1, issuePage: 1 } })),
      setIterationFilter: (value) => set((state) => ({ filters: { ...state.filters, iteration: value }, pagination: { ...state.pagination, reqPage: 1, issuePage: 1 } })),
      clearFilters: () => set((state) => ({ filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" }, pagination: { ...state.pagination, reqPage: 1, issuePage: 1 } })),
      setReqPage: (page) => set((state) => ({ pagination: { ...state.pagination, reqPage: page } })),
      setIssuePage: (page) => set((state) => ({ pagination: { ...state.pagination, issuePage: page } })),
      setAIConfig: (patch) => set((state) => ({ aiConfig: { ...state.aiConfig, ...patch } })),
      importTableData: (requirementsInput, issuesInput, timelineInput = [], source = "表格导入") => {
        const next = normalizeSnapshots(requirementsInput, issuesInput, timelineInput);
        set((state) => ({
          previous: state.current,
          current: next,
          filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
          syncMeta: { source, updatedAt: nowString() },
          error: "",
          pagination: { ...state.pagination, reqPage: 1, issuePage: 1 }
        }));
        void get().rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
      },
      importFilesWithAI: async (files, manualTypes = {}) => {
        set({ uploadedTables: [], aiRecognitionResults: [], aiFieldMappings: [] });
        await executeWorkflow(get, set, { files, manualTypes, scope: "all_files", steps: ALL_STEPS });
        set((state) => ({ syncMeta: { source: "AI 智能导入", updatedAt: nowString() }, previous: state.previous ?? state.current }));
      },
      overrideRecognition: async (fileName, tableType) => {
        const uploadedTables = get().uploadedTables;
        if (!uploadedTables.length) return;
        const manualTypes = Object.fromEntries(get().aiRecognitionResults.map((item) => [item.fileName, item.finalType])) as Record<string, AITableType>;
        manualTypes[fileName] = tableType;
        await executeWorkflow(get, set, { manualTypes, scope: "all_files", steps: ["recognize", "mapping", "transfer", "release", "followup", "highlight"] });
      },
      rerunAIAnalysis: async (options = {}) => {
        await executeWorkflow(get, set, { scope: options.scope ?? "all_files", steps: options.steps ?? ALL_STEPS, files: options.files, manualTypes: options.manualTypes });
      },
      retryAIStep: async (step, scope = "all_files") => {
        const extra = step === "recognize" || step === "mapping" ? (["transfer", "release", "followup", "highlight"] as AIStep[]) : step === "transfer" || step === "release" ? (["followup", "highlight"] as AIStep[]) : step === "followup" ? (["highlight"] as AIStep[]) : [];
        await executeWorkflow(get, set, { scope, steps: [step, ...extra] });
      },
      syncFromApis: async (requirementUrl, issueUrl) => {
        set({ loading: true, error: "" });
        try {
          const { requirementPayload, issuePayload } = await syncApi(requirementUrl, issueUrl);
          const next = normalizeSnapshots(extractRequirementsFromResponse(requirementPayload), extractIssuesFromResponse(issuePayload), get().current.timelines.map((item) => item.raw));
          set((state) => ({ loading: false, previous: state.current, current: next, filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" }, syncMeta: { source: "API(双接口)", updatedAt: nowString() } }));
          await get().rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "同步失败" });
        }
      },
      syncFromCombined: async (url) => {
        set({ loading: true, error: "" });
        try {
          const payload = await syncCombined(url);
          const next = normalizeSnapshots(extractRequirementsFromResponse(payload), extractIssuesFromResponse(payload), get().current.timelines.map((item) => item.raw));
          set((state) => ({ loading: false, previous: state.current, current: next, filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" }, syncMeta: { source: "API(单接口)", updatedAt: nowString() } }));
          await get().rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "同步失败" });
        }
      },
      syncHuawei: async (url) => {
        set({ loading: true, error: "" });
        try {
          const payload = await syncHuaweiIssues(url);
          const mappedIssues = extractIssuesFromResponse(payload).map((item) => mapHuaweiIssue(item).raw);
          const next = normalizeSnapshots(get().current.requirements.map((item) => item.raw), mappedIssues, get().current.timelines.map((item) => item.raw));
          set((state) => ({ loading: false, previous: state.current, current: next, filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" }, syncMeta: { source: "华为问题单 API(POST)", updatedAt: nowString() } }));
          await get().rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "华为问题单同步失败" });
        }
      },
      loadSeed: () => {
        const next = normalizeSnapshots(seedRequirements, seedIssues, seedIterationTimelines);
        set((state) => ({ previous: state.current, current: next, filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" }, syncMeta: { source: "演示数据", updatedAt: nowString() }, error: "" }));
        void get().rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
      },
      clearError: () => set({ error: "" }),
      clearAIErrors: () => set({ aiErrors: [] }),
      setSelfAuditEnabled: (enabled) => set((state) => ({ selfAudit: { ...state.selfAudit, enabled } })),
      triggerSelfAudit: async () => {
        await executeSelfAudit(get, set, "all");
      },
      triggerPartialAudit: async (scope) => {
        await executeSelfAudit(get, set, scope);
      },
      clearSelfAuditResult: () => set((state) => ({ selfAudit: { ...state.selfAudit, report: null, findings: [], errors: [], findingCount: 0, progressPercent: 0, status: "idle", currentStep: "", finishedAt: "" } })),
      exportCurrentJson: () => JSON.stringify(get().current, null, 2)
    }),
    {
      name: "pm-react-store",
      version: 4,
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState as ProjectState;
        const state = persistedState as Record<string, unknown>;
        const current = (state.current && typeof state.current === "object" ? state.current : {}) as Record<string, unknown>;
        const previous = (state.previous && typeof state.previous === "object" ? state.previous : null) as Record<string, unknown> | null;
        return {
          ...state,
          current: { requirements: Array.isArray(current.requirements) ? current.requirements : [], issues: Array.isArray(current.issues) ? current.issues : [], timelines: Array.isArray(current.timelines) ? current.timelines : [] },
          previous: previous ? { requirements: Array.isArray(previous.requirements) ? previous.requirements : [], issues: Array.isArray(previous.issues) ? previous.issues : [], timelines: Array.isArray(previous.timelines) ? previous.timelines : [] } : null,
          aiConfig: { ...getDefaultAIConfig(), ...(state.aiConfig && typeof state.aiConfig === "object" ? state.aiConfig : {}) },
          aiJob: EMPTY_AI_JOB,
          aiRecognitionResults: [],
          aiFieldMappings: [],
          aiTransferRiskResults: [],
          aiReleaseRiskResults: [],
          aiFollowupSuggestions: [],
          highlightedRequirementRisks: [],
          highlightedIssueRisks: [],
          highlightedOwners: [],
          selfAudit: { ...EMPTY_SELF_AUDIT, ...(state.selfAudit && typeof state.selfAudit === "object" ? { enabled: Boolean((state.selfAudit as Record<string, unknown>).enabled ?? true) } : {}) },
          aiLoading: false,
          aiErrors: [],
          uploadedTables: []
        } as unknown as ProjectState;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        current: state.current,
        previous: state.previous,
        filters: state.filters,
        pagination: state.pagination,
        syncMeta: state.syncMeta,
        aiConfig: state.aiConfig,
        selfAudit: { enabled: state.selfAudit.enabled }
      })
    }
  )
);
