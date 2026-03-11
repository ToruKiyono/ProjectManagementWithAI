import { useMemo } from "react";
import { SyncPanel } from "../components/sync/SyncPanel";
import type { Issue } from "../domain/models/issue";
import { issueStatuses } from "../domain/models/issue";
import type { IterationTimeline } from "../domain/models/iterationTimeline";
import type { Requirement } from "../domain/models/requirement";
import { requirementStages } from "../domain/models/requirement";
import { daysBetween, todayLocalStr } from "../utils/date";
import type { ProjectState } from "../store/useProjectStore";
import { selectDerived, useProjectStore } from "../store/useProjectStore";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function badgeTone(type: "good" | "warn" | "danger" | "neutral") {
  return {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200"
  }[type];
}

function metricTone(passed: boolean) {
  return passed ? "text-emerald-700" : "text-rose-700";
}

function formatDI(value: number) {
  return value.toFixed(value % 1 === 0 ? 0 : 1);
}

function compactNames(values: string[]) {
  return values.filter(Boolean).join("、") || "-";
}

function stageIndex(stage: string) {
  return requirementStages.indexOf(stage as (typeof requirementStages)[number]);
}

function getTimelineStatus(timeline?: Pick<IterationTimeline, "startDate" | "endDate"> | null) {
  const today = todayLocalStr();
  if (!timeline?.startDate || !timeline?.endDate) {
    return { label: "未维护", tone: "neutral" as const, progress: 0, overdue: false };
  }
  if (today < timeline.startDate) {
    const totalDays = Math.max(daysBetween(timeline.startDate, timeline.endDate) ?? 1, 1);
    return { label: "未开始", tone: "neutral" as const, progress: 0, overdue: false, totalDays };
  }
  if (today > timeline.endDate) {
    return { label: "已超窗", tone: "danger" as const, progress: 100, overdue: true };
  }
  const totalDays = Math.max((daysBetween(timeline.startDate, timeline.endDate) ?? 0) + 1, 1);
  const usedDays = Math.max((daysBetween(timeline.startDate, today) ?? 0) + 1, 0);
  return {
    label: "进行中",
    tone: "warn" as const,
    progress: Math.min(100, Math.round((usedDays / totalDays) * 100)),
    overdue: false,
    totalDays
  };
}

function getIterationStageAlert(iteration: DashboardState["iterationSummaries"][number], stage: DashboardState["iterationSummaries"][number]["stages"][number]) {
  const timelineStatus = getTimelineStatus({ startDate: iteration.timelineStartDate, endDate: iteration.timelineEndDate });
  const currentStageIdx = stageIndex(stage.stage);
  const lateStage = stageIndex("需求转测");
  const overdue = timelineStatus.overdue && currentStageIdx < lateStage;
  const nearEnd = !timelineStatus.overdue && timelineStatus.progress >= 80 && currentStageIdx < lateStage;
  if (overdue) return "bg-rose-50";
  if (nearEnd) return "bg-amber-50";
  return "";
}

type DashboardState = ReturnType<typeof selectDerived>;
type QuickStat = {
  label: string;
  value: string;
  tone?: "good" | "warn" | "danger" | "neutral";
};

function renderTopFilters(derived: DashboardState, store: ProjectState) {
  const quickStats: QuickStat[] = [
    { label: "小迭代数", value: String(derived.topStats.iterationCount) },
    { label: "需求总数", value: String(derived.topStats.requirementCount) },
    { label: "风险需求", value: String(derived.topStats.riskRequirementCount), tone: derived.topStats.riskRequirementCount > 0 ? "warn" : "good" as const },
    { label: "问题单总数", value: String(derived.topStats.issueCount) },
    { label: "未关闭问题单", value: String(derived.topStats.openIssueCount), tone: derived.topStats.openIssueCount > 0 ? "warn" : "good" as const },
    { label: "总 DI", value: formatDI(derived.topStats.totalDI) },
    { label: "未关闭 DI", value: formatDI(derived.topStats.openDI), tone: derived.topStats.openDI > 8 ? "danger" : derived.topStats.openDI > 0 ? "warn" : "good" as const },
    { label: "发布准入", value: derived.topStats.releaseGateStatus, tone: derived.topStats.releaseGateStatus === "通过" ? "good" : derived.topStats.releaseGateStatus === "阻塞" ? "danger" : "neutral" as const }
  ];

  return (
    <section className="panel space-y-3">
      <div className="grid gap-3 xl:grid-cols-[220px_220px_260px_1fr]">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">大版本</span>
          <select className="input" value={store.filters.versionLine} onChange={(event) => store.setVersionLineFilter(event.target.value)}>
            {derived.options.versionLines.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">版本号</span>
          <select className="input" value={store.filters.releaseVersion} onChange={(event) => store.setReleaseVersionFilter(event.target.value)}>
            {derived.options.releaseVersions.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">小迭代</span>
          <select className="input" value={store.filters.iteration} onChange={(event) => store.setIterationFilter(event.target.value)}>
            {derived.options.iterations.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <div className="flex items-end justify-end">
          <button className="btn-secondary" onClick={store.clearFilters}>清空筛选</button>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
        {quickStats.map((item) => (
          <div key={item.label} className={cx("rounded-lg border px-3 py-2", badgeTone(item.tone ?? "neutral"))}>
            <div className="text-[11px] uppercase tracking-[0.18em] opacity-70">{item.label}</div>
            <div className="mt-1 text-xl font-semibold">{item.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function renderIterationRequirementBoard(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">小迭代需求推进驾驶舱</div>
        <div className="text-xs text-slate-500">按小迭代组织需求，直接暴露卡点、阶段和风险责任人</div>
      </div>

      <div className="space-y-2">
        {derived.iterationSummaries.map((iteration) => (
          <details key={iteration.key} className="rounded-xl border border-slate-200 bg-slate-50/70" open>
            <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 lg:grid-cols-[220px_120px_1fr_180px_160px]">
              <div>
                <div className="text-sm font-semibold text-slate-900">{iteration.fullVersion}</div>
                <div className="text-xs text-slate-500">{iteration.versionLine} / {iteration.releaseVersion}</div>
              </div>
              <div className="text-sm text-slate-700">
                <div>需求 {iteration.requirementCount}</div>
                <div className="text-amber-700">风险 {iteration.riskCount}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {requirementStages.map((stage) => iteration.stageDistribution[stage] ? (
                  <span key={stage} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                    {stage} {iteration.stageDistribution[stage]}
                  </span>
                ) : null)}
              </div>
              <div className="text-xs text-slate-600">
                <div>风险责任人</div>
                <div className="mt-1 font-medium text-slate-800">{compactNames(iteration.riskOwners)}</div>
              </div>
              <div className="text-xs text-slate-600">
                <div>计划上线 {iteration.onlinePlanTime || "-"}</div>
                <div>迭代窗口 {iteration.timelineStartDate || "-"} ~ {iteration.timelineEndDate || "-"}</div>
                <div className={cx("mt-1 font-semibold", iteration.hasBlocker || getTimelineStatus({ startDate: iteration.timelineStartDate, endDate: iteration.timelineEndDate }).overdue ? "text-rose-700" : "text-emerald-700")}>
                  {iteration.hasBlocker ? `卡点: ${iteration.blockerStages.join("、")}` : "无明显卡点"}
                </div>
              </div>
            </summary>

            <div className="border-t border-slate-200 bg-white">
              <div className="table-wrap rounded-none border-0">
                <table className="table text-[12px]">
                  <thead>
                    <tr>
                      <th>阶段</th>
                      <th>数量</th>
                      <th>风险</th>
                      <th>责任人</th>
                      <th>测试责任人</th>
                      <th>平均进度</th>
                      <th>风险原因</th>
                      <th>需求列表</th>
                    </tr>
                  </thead>
                  <tbody>
                    {iteration.stages.filter((stage) => stage.count > 0).map((stage) => (
                      <tr key={stage.stage} className={getIterationStageAlert(iteration, stage)}>
                        <td className="font-medium text-slate-800">{stage.stage}</td>
                        <td>{stage.count}</td>
                        <td className={stage.riskCount > 0 ? "text-amber-700" : "text-slate-500"}>{stage.riskCount}</td>
                        <td>{compactNames(stage.owners)}</td>
                        <td>{compactNames(stage.testers)}</td>
                        <td>
                          <div className="w-28">
                            <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                              <span>{stage.avgProgressPercent}%</span>
                            </div>
                            <div className="h-2 rounded-full bg-slate-100">
                              <div className="h-2 rounded-full bg-cyan-500" style={{ width: `${stage.avgProgressPercent}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="max-w-[260px] text-slate-600">{stage.riskReasons.join("；") || "-"}</td>
                        <td>
                          <div className="space-y-1">
                            {stage.items.map((item) => (
                              <div key={item.id} className="rounded-md border border-slate-200 px-2 py-1">
                                <div className="font-medium text-slate-800">{item.id} {item.title}</div>
                                <div className="text-[11px] text-slate-500">
                                  {item.owner} / 测试 {item.tester} / {item.progressPercent}% / {item.risk || "无显式风险"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function renderTimelineGanttPanel(derived: DashboardState) {
  const rows = derived.iterationSummaries
    .map((iteration) => ({
      ...iteration,
      timelineStatus: getTimelineStatus({ startDate: iteration.timelineStartDate, endDate: iteration.timelineEndDate })
    }))
    .sort((a, b) => (a.timelineStartDate || "9999-12-31").localeCompare(b.timelineStartDate || "9999-12-31", "zh-CN"));

  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">小迭代甘特 / 周期条视图</div>
        <div className="text-xs text-slate-500">横向展示小迭代窗口、阶段位置与是否超期，便于按节奏管理</div>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const stageProgress = row.items.length
            ? Math.round((Math.max(...row.items.map((item) => Math.max(stageIndex(item.stage), 0))) + 1) / requirementStages.length * 100)
            : 0;
          return (
            <div key={row.key} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{row.fullVersion}</div>
                  <div className="text-[11px] text-slate-500">{row.versionLine} / {row.releaseVersion} / {row.timelineStartDate || "-"} ~ {row.timelineEndDate || "-"}</div>
                </div>
                <div className={cx("rounded-md border px-2 py-1 text-xs font-semibold", badgeTone(row.timelineStatus.tone))}>
                  {row.timelineStatus.label}
                </div>
              </div>
              <div className="space-y-2">
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>时间轴进度</span>
                    <span>{row.timelineStatus.progress}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx("h-3 rounded-full", row.timelineStatus.overdue ? "bg-rose-500" : row.timelineStatus.tone === "warn" ? "bg-amber-500" : "bg-slate-400")} style={{ width: `${row.timelineStatus.progress}%` }} />
                  </div>
                </div>
                <div>
                  <div className="mb-1 flex justify-between text-[11px] text-slate-500">
                    <span>需求阶段推进</span>
                    <span>{stageProgress}%</span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div className={cx("h-3 rounded-full", row.timelineStatus.overdue && stageProgress < 70 ? "bg-rose-500" : "bg-cyan-500")} style={{ width: `${stageProgress}%` }} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {requirementStages.map((stage) => (
                    <span
                      key={stage}
                      className={cx(
                        "rounded-md border px-2 py-1 text-[11px]",
                        row.stageDistribution[stage]
                          ? stageIndex(stage) < stageIndex("需求转测") && row.timelineStatus.overdue
                            ? "border-rose-200 bg-rose-50 text-rose-700"
                            : "border-cyan-200 bg-cyan-50 text-cyan-700"
                          : "border-slate-200 bg-slate-50 text-slate-400"
                      )}
                    >
                      {stage}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function renderTimelineTable(derived: DashboardState) {
  const timelineRows = derived.scopedTimelines
    .map((timeline) => {
      const linkedIteration = derived.iterationSummaries.find((item) => item.fullVersion === timeline.fullVersion);
      const status = getTimelineStatus(timeline);
      return { timeline, linkedIteration, status };
    })
    .sort((a, b) => (a.timeline.startDate || "9999-12-31").localeCompare(b.timeline.startDate || "9999-12-31", "zh-CN"));

  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">时间轴明细表</div>
        <div className="text-xs text-slate-500">单独查看每个小迭代的开始/结束时间、窗口状态和需求推进情况</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>大版本</th>
              <th>版本号</th>
              <th>小迭代</th>
              <th>开始时间</th>
              <th>结束时间</th>
              <th>窗口状态</th>
              <th>需求数</th>
              <th>风险需求</th>
              <th>当前卡点</th>
              <th>责任人</th>
            </tr>
          </thead>
          <tbody>
            {timelineRows.map(({ timeline, linkedIteration, status }) => (
              <tr key={timeline.id} className={status.overdue ? "bg-rose-50/80" : status.tone === "warn" ? "bg-amber-50/70" : ""}>
                <td>{timeline.versionLine}</td>
                <td>{timeline.releaseVersion}</td>
                <td className="font-medium text-slate-800">{timeline.fullVersion}</td>
                <td>{timeline.startDate || "-"}</td>
                <td>{timeline.endDate || "-"}</td>
                <td>
                  <span className={cx("rounded-md border px-2 py-1 text-[11px] font-semibold", badgeTone(status.tone))}>
                    {status.label}
                  </span>
                </td>
                <td>{linkedIteration?.requirementCount ?? 0}</td>
                <td className={(linkedIteration?.riskCount ?? 0) > 0 ? "text-amber-700" : ""}>{linkedIteration?.riskCount ?? 0}</td>
                <td>{linkedIteration?.blockerStages.join("、") || "-"}</td>
                <td>{timeline.owner || compactNames(linkedIteration?.riskOwners ?? [])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function issueRelationLabel(issue: Issue) {
  if (issue.versionRelation === "current-major" || issue.versionRelation === "current") return "关联当前大版本";
  if (issue.versionRelation === "old-major" || issue.versionRelation === "old") return "关联老版本";
  return "未关联版本";
}

function renderMajorVersionIssueBoard(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">大版本问题单管控驾驶舱</div>
        <div className="text-xs text-slate-500">按 HC / HCS / HCSO / 会战版本聚合问题单、DI 和发布阻塞</div>
      </div>

      <div className="space-y-3">
        {derived.majorSummaries.map((summary) => (
          <details key={summary.versionLine} className="rounded-xl border border-slate-200 bg-slate-50/70" open>
            <summary className="grid cursor-pointer list-none gap-2 px-3 py-3 xl:grid-cols-[180px_repeat(6,minmax(0,1fr))]">
              <div>
                <div className="text-base font-semibold text-slate-900">{summary.versionLine}</div>
                <div className={cx("text-xs font-semibold", metricTone(summary.releaseGate.passed))}>
                  {summary.releaseGate.passed ? "发布可放行" : "发布阻塞"}
                </div>
              </div>
              <div><div className="text-[11px] text-slate-500">问题单总数</div><div className="text-lg font-semibold">{summary.total}</div></div>
              <div><div className="text-[11px] text-slate-500">未关闭</div><div className="text-lg font-semibold text-amber-700">{summary.open}</div></div>
              <div><div className="text-[11px] text-slate-500">已关闭</div><div className="text-lg font-semibold">{summary.closed}</div></div>
              <div><div className="text-[11px] text-slate-500">总 DI</div><div className="text-lg font-semibold">{formatDI(summary.totalDI)}</div></div>
              <div><div className="text-[11px] text-slate-500">未关闭 DI</div><div className="text-lg font-semibold text-rose-700">{formatDI(summary.openDI)}</div></div>
              <div><div className="text-[11px] text-slate-500">风险问题单</div><div className="text-lg font-semibold">{summary.riskCount}</div></div>
            </summary>

            <div className="grid gap-3 border-t border-slate-200 bg-white p-3 xl:grid-cols-[320px_320px_1fr]">
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">状态分布</div>
                <div className="mt-2 grid gap-1">
                  {issueStatuses.map((status) => (
                    <div key={status} className="flex items-center justify-between text-sm">
                      <span>{status}</span>
                      <span className="font-semibold">{summary.statusCounts[status] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">严重度分布</div>
                <div className="mt-2 grid gap-1">
                  {["提示", "一般", "严重", "致命"].map((severity) => (
                    <div key={severity} className="flex items-center justify-between text-sm">
                      <span>{severity}</span>
                      <span className="font-semibold">{summary.severityCounts[severity] ?? 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">准入结论</div>
                <div className={cx("mt-2 text-sm font-semibold", metricTone(summary.releaseGate.passed))}>
                  {summary.releaseGate.passed ? "通过" : "不通过"}
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {(summary.releaseGate.reasons.length ? summary.releaseGate.reasons : ["无阻塞项"]).map((reason) => (
                    <div key={reason}>{reason}</div>
                  ))}
                </div>
              </div>
            </div>

            <div className="table-wrap rounded-none border-x-0 border-b-0">
              <table className="table text-[12px]">
                <thead>
                  <tr>
                    <th>问题编号</th>
                    <th>标题</th>
                    <th>严重程度</th>
                    <th>DI</th>
                    <th>当前状态</th>
                    <th>当前阶段</th>
                    <th>团队</th>
                    <th>责任人</th>
                    <th>测试责任人</th>
                    <th>发现版本</th>
                    <th>发现迭代</th>
                    <th>版本关联</th>
                    <th>承诺修复时间</th>
                    <th>是否超期</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.items.map((item) => (
                    <tr key={item.id}>
                      <td className="font-medium text-slate-800">{item.id}</td>
                      <td className="max-w-[320px]">{item.title}</td>
                      <td>{item.severity}</td>
                      <td>{formatDI(item.severityScore)}</td>
                      <td>{item.status}</td>
                      <td>{item.stage}</td>
                      <td>{item.team || "-"}</td>
                      <td>{item.currentOwner || item.owner || "-"}</td>
                      <td>{item.tester || "-"}</td>
                      <td>{item.foundVersion || item.releaseVersion || "-"}</td>
                      <td>{item.foundIteration || item.fullVersion || "-"}</td>
                      <td>{issueRelationLabel(item)}</td>
                      <td>{item.dueDate || "-"}</td>
                      <td className={item.dueDate && item.dueDate < "2026-03-12" && item.status !== "关闭" ? "text-rose-700" : ""}>
                        {item.dueDate && item.dueDate < "2026-03-12" && item.status !== "关闭" ? "超期" : "否"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

function renderTeamIssueDIPanel(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">团队问题单与 DI 视图</div>
        <div className="text-xs text-slate-500">按未关闭 DI 降序，快速识别当前问题最重的团队</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>团队</th>
              <th>问题单总数</th>
              <th>未关闭</th>
              <th>严重</th>
              <th>致命</th>
              <th>总 DI</th>
              <th>未关闭 DI</th>
              <th>主要责任人</th>
            </tr>
          </thead>
          <tbody>
            {derived.teamSummaries.map((item) => (
              <tr key={item.team}>
                <td className="font-medium text-slate-800">{item.team}</td>
                <td>{item.total}</td>
                <td>{item.open}</td>
                <td>{item.severe}</td>
                <td>{item.critical}</td>
                <td>{formatDI(item.totalDI)}</td>
                <td className={item.openDI > 5 ? "text-rose-700 font-semibold" : ""}>{formatDI(item.openDI)}</td>
                <td>{compactNames(item.primaryOwners)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderOwnerFollowupPanel(derived: DashboardState) {
  return (
    <section className="panel space-y-4">
      <div>
        <div className="panel-title">责任人盯办视图</div>
        <div className="text-xs text-slate-500">直接回答谁手里挂了最多风险、谁需要立即知会</div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">需求风险责任人</div>
          <div className="table-wrap">
            <table className="table text-[12px]">
              <thead>
                <tr>
                  <th>责任人</th>
                  <th>风险需求数</th>
                  <th>所属小迭代</th>
                  <th>风险阶段分布</th>
                  <th>高风险需求</th>
                </tr>
              </thead>
              <tbody>
                {derived.ownerFollowup.requirementOwners.map((item) => (
                  <tr key={item.owner}>
                    <td className="font-medium text-slate-800">{item.owner}</td>
                    <td>{item.riskRequirementCount}</td>
                    <td>{item.iterations.join("、")}</td>
                    <td>{Object.entries(item.stageDistribution).map(([stage, count]) => `${stage}(${count})`).join("、")}</td>
                    <td className="max-w-[300px]">{item.topItems.slice(0, 3).map((risk) => `${risk.itemId} ${risk.reason}`).join("；")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold text-slate-800">问题单责任人</div>
          <div className="table-wrap">
            <table className="table text-[12px]">
              <thead>
                <tr>
                  <th>责任人</th>
                  <th>问题单数</th>
                  <th>未关闭</th>
                  <th>未关闭 DI</th>
                  <th>所属团队</th>
                  <th>问题单列表</th>
                </tr>
              </thead>
              <tbody>
                {derived.ownerFollowup.issueOwners.map((item) => (
                  <tr key={item.owner}>
                    <td className="font-medium text-slate-800">{item.owner}</td>
                    <td>{item.issueCount}</td>
                    <td>{item.openIssueCount}</td>
                    <td className={item.openDI > 5 ? "text-rose-700 font-semibold" : ""}>{formatDI(item.openDI)}</td>
                    <td>{item.teams.join("、")}</td>
                    <td className="max-w-[300px]">{item.items.slice(0, 3).map((risk) => `${risk.itemId} ${risk.reason}`).join("；")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function renderReleaseGatePanel(derived: DashboardState) {
  const timelineCoverage = derived.iterationSummaries.filter((item) => item.timelineStartDate && item.timelineEndDate).length;
  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="panel-title">发布准入视图</div>
          <div className="text-xs text-slate-500">从大版本角度判断是否可发布，并列出阻塞原因与团队未关闭 DI</div>
        </div>
        <div className={cx("text-lg font-semibold", metricTone(derived.releaseGateOverview.passed))}>
          {derived.releaseGateOverview.passed ? "当前大版本可发布" : "当前大版本不可发布"}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[220px_220px_1fr_1fr]">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">当前总 DI</div>
          <div className="mt-1 text-2xl font-semibold">{formatDI(derived.releaseGateOverview.metrics.totalDI)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">未关闭 DI</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700">{formatDI(derived.releaseGateOverview.metrics.openDI)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">时间轴覆盖</div>
          <div className="mt-1 text-2xl font-semibold">{timelineCoverage}/{derived.iterationSummaries.length}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">不通过原因</div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {(derived.releaseGateOverview.reasons.length ? derived.releaseGateOverview.reasons : ["无阻塞原因"]).map((reason) => (
              <div key={reason}>{reason}</div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2 xl:col-span-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">各团队未关闭问题单 DI</div>
          <div className="mt-2 grid gap-1 text-sm text-slate-600">
            {derived.teamSummaries.slice(0, 6).map((item) => (
              <div key={item.team} className="flex items-center justify-between">
                <span>{item.team}</span>
                <span className={item.openDI > 5 ? "font-semibold text-rose-700" : "font-medium"}>{formatDI(item.openDI)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderRequirementTable(derived: DashboardState, store: ProjectState) {
  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="panel-title">需求明细表</div>
        <div className="text-xs text-slate-500">第 {derived.requirementPage.page} / {derived.requirementPage.totalPages} 页，共 {derived.requirementPage.total} 条</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>编号</th>
              <th>标题</th>
              <th>大版本</th>
              <th>版本号</th>
              <th>小迭代</th>
              <th>阶段</th>
              <th>责任人</th>
              <th>测试责任人</th>
              <th>进度</th>
              <th>规划上线时间</th>
              <th>风险</th>
            </tr>
          </thead>
          <tbody>
            {derived.requirementPage.items.map((item: Requirement) => (
              <tr key={item.id}>
                <td className="font-medium text-slate-800">{item.id}</td>
                <td>{item.title}</td>
                <td>{item.versionLine}</td>
                <td>{item.releaseVersion}</td>
                <td>{item.fullVersion}</td>
                <td>{item.stage}</td>
                <td>{item.owner}</td>
                <td>{item.tester || "-"}</td>
                <td>{item.progressPercent}%</td>
                <td>{item.onlinePlanTime || "-"}</td>
                <td className={item.risk ? "text-amber-700" : "text-slate-500"}>{item.risk || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" disabled={derived.requirementPage.page <= 1} onClick={() => store.setReqPage(derived.requirementPage.page - 1)}>上一页</button>
        <button className="btn-secondary" disabled={derived.requirementPage.page >= derived.requirementPage.totalPages} onClick={() => store.setReqPage(derived.requirementPage.page + 1)}>下一页</button>
      </div>
    </section>
  );
}

function renderIssueTable(derived: DashboardState, store: ProjectState) {
  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="panel-title">问题单明细表</div>
        <div className="text-xs text-slate-500">第 {derived.issuePage.page} / {derived.issuePage.totalPages} 页，共 {derived.issuePage.total} 条</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>问题编号</th>
              <th>标题</th>
              <th>大版本</th>
              <th>版本号</th>
              <th>发现迭代</th>
              <th>严重程度</th>
              <th>DI</th>
              <th>状态</th>
              <th>团队</th>
              <th>责任人</th>
              <th>测试责任人</th>
              <th>承诺修复时间</th>
            </tr>
          </thead>
          <tbody>
            {derived.issuePage.items.map((item: Issue) => (
              <tr key={item.id}>
                <td className="font-medium text-slate-800">{item.id}</td>
                <td>{item.title}</td>
                <td>{item.versionLine || "-"}</td>
                <td>{item.releaseVersion || "-"}</td>
                <td>{item.foundIteration || item.fullVersion || "-"}</td>
                <td>{item.severity}</td>
                <td>{formatDI(item.severityScore)}</td>
                <td>{item.status}</td>
                <td>{item.team || "-"}</td>
                <td>{item.currentOwner || item.owner || "-"}</td>
                <td>{item.tester || "-"}</td>
                <td>{item.dueDate || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" disabled={derived.issuePage.page <= 1} onClick={() => store.setIssuePage(derived.issuePage.page - 1)}>上一页</button>
        <button className="btn-secondary" disabled={derived.issuePage.page >= derived.issuePage.totalPages} onClick={() => store.setIssuePage(derived.issuePage.page + 1)}>下一页</button>
      </div>
    </section>
  );
}

export function App() {
  const store = useProjectStore();
  const derived = useMemo(() => selectDerived(store), [store]);

  return (
    <main className="mx-auto max-w-[1800px] space-y-4 px-4 py-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">版本管理双主轴驾驶舱</h1>
        <p className="text-sm text-slate-500">默认首页同时呈现小迭代需求推进、大版本问题单、团队 DI、责任人盯办和发布准入</p>
      </header>

      {store.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center justify-between gap-3">
            <span>{store.error}</span>
            <button className="btn-secondary" onClick={store.clearError}>关闭</button>
          </div>
        </div>
      ) : null}

      <SyncPanel />
      {renderTopFilters(derived, store)}
      {renderIterationRequirementBoard(derived)}
      {renderMajorVersionIssueBoard(derived)}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {renderTeamIssueDIPanel(derived)}
        {renderOwnerFollowupPanel(derived)}
      </div>
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {renderTimelineGanttPanel(derived)}
        {renderTimelineTable(derived)}
      </div>
      {renderReleaseGatePanel(derived)}
      {renderRequirementTable(derived, store)}
      {renderIssueTable(derived, store)}
    </main>
  );
}
