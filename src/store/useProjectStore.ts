import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
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

export type ProjectState = {
  current: Snapshot;
  previous: Snapshot | null;
  filters: Filters;
  pagination: PaginationState;
  syncMeta: SyncMeta;
  loading: boolean;
  error: string;
  setVersionLineFilter: (value: string) => void;
  setReleaseVersionFilter: (value: string) => void;
  setIterationFilter: (value: string) => void;
  clearFilters: () => void;
  setReqPage: (page: number) => void;
  setIssuePage: (page: number) => void;
  importTableData: (
    requirementsInput: Record<string, unknown>[],
    issuesInput: Record<string, unknown>[],
    timelineInput?: Record<string, unknown>[],
    source?: string
  ) => void;
  syncFromApis: (requirementUrl: string, issueUrl: string) => Promise<void>;
  syncFromCombined: (url: string) => Promise<void>;
  syncHuawei: (url: string) => Promise<void>;
  loadSeed: () => void;
  clearError: () => void;
  exportCurrentJson: () => string;
};

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

function normalizeSnapshots(
  requirementsInput: Record<string, unknown>[],
  issuesInput: Record<string, unknown>[],
  timelineInput: Record<string, unknown>[] = []
): Snapshot {
  const requirements = requirementsInput.map((item, index) => normalizeRequirement(item, index));
  const requirementVersionMap = new Map(requirements.map((item) => [item.id, item]));
  const timelines = timelineInput.map((item, index) => normalizeIterationTimeline(item, index));
  const issues = issuesInput.map((item, index) => {
    const normalized = normalizeIssue(item, index);
    const requirement = requirementVersionMap.get(normalized.requirementId);
    return requirement ? { ...normalized, ...mergeVersionInfo(normalized, requirement) } : normalized;
  });
  return { requirements, issues, timelines };
}

function nowString() {
  return new Date().toLocaleString("zh-CN", { hour12: false });
}

function paginate<T>(list: T[], page: number, pageSize: number) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.max(1, Math.min(totalPages, page));
  const start = (safePage - 1) * pageSize;
  return { page: safePage, total, totalPages, items: list.slice(start, start + pageSize) };
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, "zh-CN"));
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

function computeMajorReleaseGate(
  versionLine: string,
  requirements: Requirement[],
  issues: Issue[],
  timelines: IterationTimeline[],
  teamSummaries: TeamIssueSummary[]
) {
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

export function selectDerived(state: ProjectState) {
  const { current, filters, pagination } = state;
  const safeCurrent = {
    requirements: current?.requirements ?? [],
    issues: current?.issues ?? [],
    timelines: current?.timelines ?? []
  };
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

  const iterationSummaries = groupRequirementsByIteration(scopedRequirements).map((group) =>
    summarizeIteration(group, group.items, scopedTimelines)
  );
  const teamSummaries = summarizeTeamDI(scopedIssues);
  const ownerFollowup = buildOwnerFollowupSummary(requirementRisks, issueRisks);

  const majorSummaries = groupIssuesByMajorVersion(scopedIssues).map(({ versionLine, items }) => {
    const requirementItems = scopedRequirements.filter((item) => item.versionLine === versionLine);
    const timelineItems = scopedTimelines.filter((item) => item.versionLine === versionLine);
    const summary = summarizeMajorVersionIssues(versionLine, items);
    const teamItems = teamSummaries.filter((item) => item.items.some((issue) => issue.versionLine === versionLine));
    return {
      ...summary,
      releaseGate: computeMajorReleaseGate(versionLine, requirementItems, items, timelineItems, teamItems)
    };
  });

  const primaryVersionLine = getPrimaryMajorVersion(majorSummaries, filters);
  const activeMajorSummary = majorSummaries.find((item) => item.versionLine === primaryVersionLine) ?? majorSummaries[0] ?? null;
  const releaseGateOverview = activeMajorSummary?.releaseGate ?? {
    passed: true,
    reasons: [],
    metrics: { totalDI: 0, openDI: 0 }
  };

  const versionLineOptions = uniqueSorted([
    ...safeCurrent.requirements.map((item) => item.versionLine),
    ...safeCurrent.issues.map((item) => item.versionLine),
    ...safeCurrent.timelines.map((item) => item.versionLine)
  ]);
  const releaseVersionOptions = uniqueSorted(
    [...safeCurrent.requirements, ...safeCurrent.issues, ...safeCurrent.timelines]
      .filter((item) => filters.versionLine === "全部" || item.versionLine === filters.versionLine)
      .map((item) => item.releaseVersion)
  );
  const iterationOptions = uniqueSorted(
    [...safeCurrent.requirements, ...safeCurrent.timelines]
      .filter((item) => (filters.versionLine === "全部" || item.versionLine === filters.versionLine) && (filters.releaseVersion === "全部" || item.releaseVersion === filters.releaseVersion))
      .map((item) => item.fullVersion)
  );

  return {
    options: {
      versionLines: ["全部", ...versionLineOptions],
      releaseVersions: ["全部", ...releaseVersionOptions],
      iterations: ["全部", ...iterationOptions]
    },
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
    requirementPage: paginate(
      [...scopedRequirements].sort((a, b) => (a.fullVersion || "").localeCompare(b.fullVersion || "", "zh-CN") || a.id.localeCompare(b.id, "zh-CN")),
      pagination.reqPage,
      pagination.pageSize
    ),
    issuePage: paginate(
      [...scopedIssues].sort((a, b) => (a.versionLine || "").localeCompare(b.versionLine || "", "zh-CN") || a.id.localeCompare(b.id, "zh-CN")),
      pagination.issuePage,
      pagination.pageSize
    )
  };
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
      setVersionLineFilter: (value) =>
        set((state) => ({
          filters: { versionLine: value, releaseVersion: "全部", iteration: "全部" },
          pagination: { ...state.pagination, reqPage: 1, issuePage: 1 }
        })),
      setReleaseVersionFilter: (value) =>
        set((state) => ({
          filters: { ...state.filters, releaseVersion: value, iteration: "全部" },
          pagination: { ...state.pagination, reqPage: 1, issuePage: 1 }
        })),
      setIterationFilter: (value) =>
        set((state) => ({
          filters: { ...state.filters, iteration: value },
          pagination: { ...state.pagination, reqPage: 1, issuePage: 1 }
        })),
      clearFilters: () =>
        set((state) => ({
          filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
          pagination: { ...state.pagination, reqPage: 1, issuePage: 1 }
        })),
      setReqPage: (page) => set((state) => ({ pagination: { ...state.pagination, reqPage: page } })),
      setIssuePage: (page) => set((state) => ({ pagination: { ...state.pagination, issuePage: page } })),
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
      },
      syncFromApis: async (requirementUrl, issueUrl) => {
        set({ loading: true, error: "" });
        try {
          const { requirementPayload, issuePayload } = await syncApi(requirementUrl, issueUrl);
          const next = normalizeSnapshots(
            extractRequirementsFromResponse(requirementPayload),
            extractIssuesFromResponse(issuePayload),
            get().current.timelines.map((item) => item.raw)
          );
          set((state) => ({
            loading: false,
            previous: state.current,
            current: next,
            filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
            syncMeta: { source: "API(双接口)", updatedAt: nowString() }
          }));
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "同步失败" });
        }
      },
      syncFromCombined: async (url) => {
        set({ loading: true, error: "" });
        try {
          const payload = await syncCombined(url);
          const next = normalizeSnapshots(
            extractRequirementsFromResponse(payload),
            extractIssuesFromResponse(payload),
            get().current.timelines.map((item) => item.raw)
          );
          set((state) => ({
            loading: false,
            previous: state.current,
            current: next,
            filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
            syncMeta: { source: "API(单接口)", updatedAt: nowString() }
          }));
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "同步失败" });
        }
      },
      syncHuawei: async (url) => {
        set({ loading: true, error: "" });
        try {
          const payload = await syncHuaweiIssues(url);
          const mappedIssues = extractIssuesFromResponse(payload).map((item) => mapHuaweiIssue(item).raw);
          const next = normalizeSnapshots(
            get().current.requirements.map((item) => item.raw),
            mappedIssues,
            get().current.timelines.map((item) => item.raw)
          );
          set((state) => ({
            loading: false,
            previous: state.current,
            current: next,
            filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
            syncMeta: { source: "华为问题单 API(POST)", updatedAt: nowString() }
          }));
        } catch (error) {
          set({ loading: false, error: error instanceof Error ? error.message : "华为问题单同步失败" });
        }
      },
      loadSeed: () => {
        const next = normalizeSnapshots(seedRequirements, seedIssues, seedIterationTimelines);
        set((state) => ({
          previous: state.current,
          current: next,
          filters: { versionLine: "全部", releaseVersion: "全部", iteration: "全部" },
          syncMeta: { source: "演示数据", updatedAt: nowString() },
          error: ""
        }));
      },
      clearError: () => set({ error: "" }),
      exportCurrentJson: () => JSON.stringify(get().current, null, 2)
    }),
    {
      name: "pm-react-store",
      version: 2,
      migrate: (persistedState: unknown) => {
        if (!persistedState || typeof persistedState !== "object") return persistedState as ProjectState;
        const state = persistedState as Record<string, unknown>;
        const current = (state.current && typeof state.current === "object" ? state.current : {}) as Record<string, unknown>;
        const previous = (state.previous && typeof state.previous === "object" ? state.previous : null) as Record<string, unknown> | null;
        return {
          ...state,
          current: {
            requirements: Array.isArray(current.requirements) ? current.requirements : [],
            issues: Array.isArray(current.issues) ? current.issues : [],
            timelines: Array.isArray(current.timelines) ? current.timelines : []
          },
          previous: previous
            ? {
                requirements: Array.isArray(previous.requirements) ? previous.requirements : [],
                issues: Array.isArray(previous.issues) ? previous.issues : [],
                timelines: Array.isArray(previous.timelines) ? previous.timelines : []
              }
            : null
        } as ProjectState;
      },
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        current: state.current,
        previous: state.previous,
        filters: state.filters,
        pagination: state.pagination,
        syncMeta: state.syncMeta
      })
    }
  )
);
