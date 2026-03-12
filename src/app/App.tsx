import { useEffect, useMemo } from "react";
import { AIActionBar } from "../components/ai/AIActionBar";
import { AIJobStatusPanel } from "../components/ai/AIJobStatusPanel";
import { AIFollowupPanel } from "../components/ai/AIFollowupPanel";
import { AIRecognitionPanel } from "../components/ai/AIRecognitionPanel";
import { AIReleaseRiskPanel } from "../components/ai/AIReleaseRiskPanel";
import { AISummaryBanner } from "../components/ai/AISummaryBanner";
import { AITransferRiskPanel } from "../components/ai/AITransferRiskPanel";
import { HighlightedIssueRisks } from "../components/ai/HighlightedIssueRisks";
import { HighlightedOwners } from "../components/ai/HighlightedOwners";
import { HighlightedRequirementRisks } from "../components/ai/HighlightedRequirementRisks";
import { AuditStatusPanel } from "../components/audit/AuditStatusPanel";
import { AuditSummaryBanner } from "../components/audit/AuditSummaryBanner";
import { SelfAuditCenter } from "../components/audit/SelfAuditCenter";
import { SyncPanel } from "../components/sync/SyncPanel";
import type { Issue } from "../domain/models/issue";
import { issueStatuses } from "../domain/models/issue";
import type { Requirement } from "../domain/models/requirement";
import { requirementStages } from "../domain/models/requirement";
import {
  buildVersionTimelineBoardView,
  getMilestoneTone,
  type VersionTimelineMilestoneView
} from "../domain/services/compute/versionTimeline";
import { extractUntrustedItemIds } from "../domain/services/audit/selfAudit";
import { seedVersionTimelineConfigs } from "../seed/versionTimelineSeed";
import type { ProjectState } from "../store/useProjectStore";
import { selectDerived, useProjectStore } from "../store/useProjectStore";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
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

function badgeTone(type: "good" | "warn" | "danger" | "neutral") {
  return {
    good: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warn: "bg-amber-50 text-amber-700 border-amber-200",
    danger: "bg-rose-50 text-rose-700 border-rose-200",
    neutral: "bg-slate-100 text-slate-700 border-slate-200"
  }[type];
}

type DashboardState = ReturnType<typeof selectDerived>;
type TimelineBoardState = ReturnType<typeof buildVersionTimelineBoardView>;

function getTimelineStatusText(status: TimelineBoardState["rows"][number]["status"]) {
  if (status === "滞后") return badgeTone("danger");
  if (status === "关注") return badgeTone("warn");
  return badgeTone("good");
}

function issueRelationLabel(issue: Issue) {
  if (issue.versionRelation === "current-major" || issue.versionRelation === "current") return "当前版本";
  if (issue.versionRelation === "old-major" || issue.versionRelation === "old") return "遗留版本";
  return "未挂版本";
}

function getMilestoneTooltip(node: VersionTimelineMilestoneView) {
  const stageSummary = requirementStages
    .filter((stage) => (node.stageCounts[stage] ?? 0) > 0)
    .map((stage) => `${stage} ${node.stageCounts[stage]}`)
    .join(" / ");

  return [
    `${node.dateLabel} ${node.label}`,
    `类型：${node.milestoneType}`,
    `迭代：${node.cycleVersion || "-"}`,
    `实际转测：${node.transferProgressActual ?? "-"}%`,
    `计划转测：${node.transferProgressPlanned ?? "-"}%`,
    `需求数：${node.requirementCount}`,
    `风险需求：${node.riskRequirementCount}`,
    `未关闭问题单：${node.openIssueCount}`,
    `阶段分布：${stageSummary || "暂无"}`
  ].join("\n");
}

function focusMilestone(store: ProjectState, versionLine: string, releaseVersion: string, milestone: VersionTimelineMilestoneView) {
  store.setVersionLineFilter(versionLine);
  store.setReleaseVersionFilter(releaseVersion);
  if (milestone.cycleVersion) {
    store.setIterationFilter(milestone.fullVersion);
  } else {
    store.setIterationFilter("全部");
  }
}

function renderTopFilters(derived: DashboardState, store: ProjectState, timelineBoard: TimelineBoardState) {
  const quickStats: Array<{ label: string; value: string; tone?: "good" | "warn" | "danger" | "neutral" }> = [
    { label: "版本轨道", value: String(timelineBoard.rows.length) },
    { label: "小迭代数", value: String(derived.topStats.iterationCount) },
    { label: "需求总数", value: String(derived.topStats.requirementCount) },
    { label: "风险需求", value: String(derived.topStats.riskRequirementCount), tone: derived.topStats.riskRequirementCount > 0 ? "warn" : "good" as const },
    { label: "未关闭问题单", value: String(derived.topStats.openIssueCount), tone: derived.topStats.openIssueCount > 0 ? "warn" : "good" as const },
    { label: "未关闭 DI", value: formatDI(derived.topStats.openDI), tone: derived.topStats.openDI > 8 ? "danger" : derived.topStats.openDI > 0 ? "warn" : "good" as const },
    { label: "节奏风险", value: String(timelineBoard.risks.length), tone: timelineBoard.risks.length > 0 ? "danger" : "good" as const },
    { label: "发布准入", value: derived.topStats.releaseGateStatus, tone: derived.topStats.releaseGateStatus === "通过" ? "good" : derived.topStats.releaseGateStatus === "阻塞" ? "danger" : "neutral" as const }
  ];

  return (
    <section className="panel space-y-3">
      <div className="grid gap-3 xl:grid-cols-[220px_220px_260px_1fr]">
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">版本线</span>
          <select className="input" value={store.filters.versionLine} onChange={(event) => store.setVersionLineFilter(event.target.value)}>
            {derived.options.versionLines.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">版本号</span>
          <select className="input" value={store.filters.releaseVersion} onChange={(event) => store.setReleaseVersionFilter(event.target.value)}>
            {derived.options.releaseVersions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">小迭代</span>
          <select className="input" value={store.filters.iteration} onChange={(event) => store.setIterationFilter(event.target.value)}>
            {derived.options.iterations.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end justify-end">
          <button className="btn-secondary" onClick={store.clearFilters}>
            清空筛选
          </button>
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

function renderVersionTimelineBoard(store: ProjectState, timelineBoard: TimelineBoardState) {
  const gridColumns = `260px repeat(${timelineBoard.weeks.length}, minmax(180px, 1fr))`;

  return (
    <section className="panel space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="panel-title">版本时间轴视图</div>
          <div className="text-xs text-slate-500">
            核心管理视图。按版本号跟踪小迭代节拍、需求转测成熟度、全量转测节点、发布评审节点，并与需求推进和风险识别联动。
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-700">普通迭代</span>
          <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">全量需求转测</span>
          <span className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-violet-700">发布评审</span>
          <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">节奏滞后 / 风险</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1460px] space-y-2">
          <div className="grid gap-2" style={{ gridTemplateColumns: gridColumns }}>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">版本轨道</div>
            {timelineBoard.weeks.map((week) => (
              <div
                key={week}
                className={cx(
                  "rounded-xl border px-3 py-3 text-center text-sm font-semibold",
                  week === timelineBoard.currentWeekRange ? "border-cyan-300 bg-cyan-50 text-cyan-800" : "border-slate-200 bg-slate-50 text-slate-700"
                )}
              >
                {week}
                {week === timelineBoard.currentWeekRange ? <div className="mt-1 text-[10px] font-medium">当前周</div> : null}
              </div>
            ))}
          </div>

          {timelineBoard.rows.map((row) => (
            <div key={`${row.versionLine}-${row.releaseVersion}`} className="grid gap-2" style={{ gridTemplateColumns: gridColumns }}>
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-semibold text-slate-900">{row.title}</div>
                    <div className="mt-1 whitespace-pre-line text-[11px] text-slate-500">{row.extraInfo}</div>
                  </div>
                  <span className={cx("inline-flex rounded-md border px-2 py-1 text-[11px] font-semibold", getTimelineStatusText(row.status))}>
                    {row.status}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-[12px] text-slate-600">
                  <div>当前推进迭代：{row.currentCycleVersion || "-"}</div>
                  <div>当前转测成熟度：{row.currentTransferLabel}</div>
                  <div>当前周状态：{row.isCurrentWeekGapRisk ? "空档风险" : "有节点推进"}</div>
                </div>
              </div>

              {timelineBoard.weeks.map((week) => {
                const nodes = row.milestones.filter((item) => item.weekRange === week);
                return (
                  <div
                    key={`${row.releaseVersion}-${week}`}
                    className={cx(
                      "min-h-[138px] rounded-2xl border p-2",
                      week === timelineBoard.currentWeekRange ? "border-cyan-200 bg-cyan-50/40" : "border-slate-200 bg-white"
                    )}
                  >
                    <div className="space-y-2">
                      {nodes.length ? (
                        nodes.map((node) => (
                          <button
                            id={`timeline-${node.id}`}
                            key={`${row.releaseVersion}-${node.dateLabel}-${node.cycleVersion || node.label}`}
                            type="button"
                            title={getMilestoneTooltip(node)}
                            className={cx(
                              "w-full rounded-xl border px-3 py-2 text-left transition hover:shadow-sm",
                              getMilestoneTone(node.milestoneType, node.isFullTransfer, node.blocked)
                            )}
                            onClick={() => focusMilestone(store, row.versionLine, row.releaseVersion, node)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="text-[11px] font-semibold">{node.dateLabel}</div>
                              {node.blocked ? <span className="text-[10px] font-semibold">滞后</span> : null}
                            </div>
                            <div className="mt-1 text-xs font-semibold">{node.label}</div>
                            <div className="mt-1 text-[11px] opacity-80">
                              转测 {node.transferProgressActual ?? node.transferProgressPlanned ?? "-"}%
                              {node.isReleaseReview ? " / 发布评审" : ""}
                            </div>
                            <div className="mt-1 text-[10px] opacity-70">
                              需求 {node.requirementCount} / 风险 {node.riskRequirementCount} / 问题 {node.openIssueCount}
                            </div>
                          </button>
                        ))
                      ) : week === timelineBoard.currentWeekRange && row.isCurrentWeekGapRisk ? (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-3 text-xs text-rose-700">
                          当前周无节点，存在空档风险
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-xs text-slate-400">-</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-600">
        点击时间轴节点会自动筛选对应小迭代需求；时间轴中的转测进度优先读取实际需求阶段聚合结果，无对应需求时回退为配置值。
      </div>
    </section>
  );
}

function renderIterationRequirementBoard(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">小迭代需求推进驾驶舱</div>
        <div className="text-xs text-slate-500">
          严格按 10 个阶段顺序展示每个小迭代的需求推进、风险分布和明细列表，直接支撑时间轴节点的成熟度判断。
        </div>
      </div>

      <div className="space-y-3">
        {derived.iterationSummaries.map((iteration) => (
          <details key={iteration.key} className="rounded-2xl border border-slate-200 bg-slate-50/70" open>
            <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 xl:grid-cols-[220px_120px_1fr_200px_220px]">
              <div>
                <div className="text-sm font-semibold text-slate-900">{iteration.fullVersion}</div>
                <div className="text-xs text-slate-500">{iteration.versionLine} / {iteration.releaseVersion}</div>
              </div>
              <div className="text-sm text-slate-700">
                <div>需求 {iteration.requirementCount}</div>
                <div className="text-amber-700">风险 {iteration.riskCount}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {requirementStages.map((stage) => (
                  <span key={stage} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600">
                    {stage} {iteration.stageDistribution[stage] ?? 0}
                  </span>
                ))}
              </div>
              <div className="text-xs text-slate-600">
                <div>风险责任人</div>
                <div className="mt-1 font-medium text-slate-800">{compactNames(iteration.riskOwners)}</div>
              </div>
              <div className="text-xs text-slate-600">
                <div>规划上线：{iteration.onlinePlanTime || "-"}</div>
                <div>时间窗：{iteration.timelineStartDate || "-"} ~ {iteration.timelineEndDate || "-"}</div>
                <div className={cx("mt-1 font-semibold", iteration.hasBlocker ? "text-rose-700" : "text-emerald-700")}>
                  {iteration.hasBlocker ? `阶段卡点：${iteration.blockerStages.join("、")}` : "当前无明显阶段卡点"}
                </div>
              </div>
            </summary>

            <div className="border-t border-slate-200 bg-white">
              <div className="table-wrap rounded-none border-0">
                <table className="table text-[12px]">
                  <thead>
                    <tr>
                      <th>阶段</th>
                      <th>需求数量</th>
                      <th>风险需求</th>
                      <th>责任人</th>
                      <th>测试责任人</th>
                      <th>平均进度</th>
                      <th>阶段风险原因</th>
                      <th>需求列表</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirementStages.map((requiredStage) => {
                      const stage = iteration.stages.find((item) => item.stage === requiredStage) ?? {
                        stage: requiredStage,
                        count: 0,
                        riskCount: 0,
                        owners: [],
                        testers: [],
                        avgProgressPercent: 0,
                        riskReasons: [],
                        items: []
                      };

                      const isTransferOrLater = stageIndex(requiredStage) >= stageIndex("需求转测");
                      const hasRisk = stage.riskCount > 0;

                      return (
                        <tr
                          key={requiredStage}
                          className={cx(
                            hasRisk ? "bg-amber-50/60" : "",
                            !isTransferOrLater && iteration.hasBlocker && stage.count > 0 ? "bg-rose-50/60" : ""
                          )}
                        >
                          <td className="font-medium text-slate-800">{requiredStage}</td>
                          <td>{stage.count}</td>
                          <td className={hasRisk ? "font-semibold text-amber-700" : "text-slate-500"}>{stage.riskCount}</td>
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
                            {stage.items.length ? (
                              <div className="space-y-2">
                                {stage.items.map((item) => (
                                  <div key={item.id} className="rounded-lg border border-slate-200 px-3 py-2">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                      <span className="font-semibold text-slate-800">{item.id}</span>
                                      <span className="text-slate-700">{item.title}</span>
                                    </div>
                                    <div className="mt-1 grid gap-1 text-[11px] text-slate-500 xl:grid-cols-3">
                                      <div>责任人：{item.owner || "-"}</div>
                                      <div>测试责任人：{item.tester || "-"}</div>
                                      <div>当前进度：{item.progressPercent}%</div>
                                      <div>风险标识：{item.risk || "无"}</div>
                                      <div>风险责任人：{item.riskOwner || item.owner || "-"}</div>
                                      <div>规划上线：{item.onlinePlanTime || "-"}</div>
                                      <div>所属版本：{item.releaseVersion || "-"}</div>
                                      <div>所属迭代：{item.fullVersion || "-"}</div>
                                      <div>当前阶段：{item.stage}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-slate-400">暂无需求</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
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

function renderVersionRiskPanel(timelineBoard: TimelineBoardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">版本节奏风险视图</div>
        <div className="text-xs text-slate-500">
          将时间轴滞后、全量转测不足、发布评审前残留风险统一纳入版本风险对象，便于按版本节奏直接判断是否异常。
        </div>
      </div>

      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>类型</th>
              <th>等级</th>
              <th>版本线</th>
              <th>版本号</th>
              <th>小迭代</th>
              <th>责任人</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {timelineBoard.risks.length ? (
              timelineBoard.risks.map((risk, index) => (
                <tr key={`${risk.versionLine}-${risk.releaseVersion}-${risk.cycleVersion}-${index}`}>
                  <td>timeline</td>
                  <td className={risk.level === "高" ? "font-semibold text-rose-700" : risk.level === "中" ? "text-amber-700" : ""}>{risk.level}</td>
                  <td>{risk.versionLine}</td>
                  <td>{risk.releaseVersion}</td>
                  <td>{risk.cycleVersion || "-"}</td>
                  <td>{risk.owner || "-"}</td>
                  <td className="max-w-[460px]">{risk.reason}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-slate-400">
                  当前筛选范围内暂无节奏风险
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function renderMajorVersionIssueBoard(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
          <div className="panel-title">大版本问题单管控驾驶舱</div>
          <div className="text-xs text-slate-500">按大版本聚合问题单、严重度、DI 和发布阻塞原因，作为问题单主视图。</div>
      </div>

      <div className="space-y-3">
        {derived.majorSummaries.map((summary) => (
          <details key={summary.versionLine} className="rounded-2xl border border-slate-200 bg-slate-50/70" open>
            <summary className="grid cursor-pointer list-none gap-3 px-4 py-4 xl:grid-cols-[180px_repeat(6,minmax(0,1fr))]">
              <div>
                <div className="text-base font-semibold text-slate-900">{summary.versionLine}</div>
                <div className={cx("mt-1 text-xs font-semibold", summary.releaseGate.passed ? "text-emerald-700" : "text-rose-700")}>
                  {summary.releaseGate.passed ? "发布可放行" : "发布阻塞"}
                </div>
              </div>
              <div><div className="text-[11px] text-slate-500">问题总数</div><div className="text-lg font-semibold">{summary.total}</div></div>
              <div><div className="text-[11px] text-slate-500">未关闭</div><div className="text-lg font-semibold text-amber-700">{summary.open}</div></div>
              <div><div className="text-[11px] text-slate-500">已关闭</div><div className="text-lg font-semibold">{summary.closed}</div></div>
              <div><div className="text-[11px] text-slate-500">总 DI</div><div className="text-lg font-semibold">{formatDI(summary.totalDI)}</div></div>
              <div><div className="text-[11px] text-slate-500">未关闭 DI</div><div className="text-lg font-semibold text-rose-700">{formatDI(summary.openDI)}</div></div>
              <div><div className="text-[11px] text-slate-500">风险问题单</div><div className="text-lg font-semibold">{summary.riskCount}</div></div>
            </summary>

            <div className="grid gap-3 border-t border-slate-200 bg-white p-4 xl:grid-cols-[300px_300px_1fr]">
              <div className="rounded-xl border border-slate-200 p-3">
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

              <div className="rounded-xl border border-slate-200 p-3">
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

              <div className="rounded-xl border border-slate-200 p-3">
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">发布准入结论</div>
                <div className={cx("mt-2 text-sm font-semibold", summary.releaseGate.passed ? "text-emerald-700" : "text-rose-700")}>
                  {summary.releaseGate.passed ? "通过" : "不通过"}
                </div>
                <div className="mt-2 space-y-1 text-sm text-slate-600">
                  {(summary.releaseGate.reasons.length ? summary.releaseGate.reasons : ["当前无阻塞项"]).map((reason) => (
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
                    <th>严重度</th>
                    <th>DI</th>
                    <th>状态</th>
                    <th>阶段</th>
                    <th>团队</th>
                    <th>责任人</th>
                    <th>测试责任人</th>
                    <th>发现版本</th>
                    <th>发现迭代</th>
                    <th>版本关联</th>
                    <th>承诺修复时间</th>
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

function renderReleaseGatePanel(derived: DashboardState, timelineBoard: TimelineBoardState) {
  const highTimelineRiskCount = timelineBoard.risks.filter((item) => item.level === "高").length;
  const delayedVersions = timelineBoard.rows.filter((item) => item.status === "滞后").length;

  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="panel-title">发布准入视图</div>
          <div className="text-xs text-slate-500">将问题单、DI、时间轴节奏风险合并判断当前筛选范围内版本是否具备发布条件。</div>
        </div>
        <div className={cx("text-lg font-semibold", derived.releaseGateOverview.passed && highTimelineRiskCount === 0 ? "text-emerald-700" : "text-rose-700")}>
          {derived.releaseGateOverview.passed && highTimelineRiskCount === 0 ? "当前版本可发布" : "当前版本不建议发布"}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-[220px_220px_220px_220px_1fr]">
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">总 DI</div>
          <div className="mt-1 text-2xl font-semibold">{formatDI(derived.releaseGateOverview.metrics.totalDI)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">未关闭 DI</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700">{formatDI(derived.releaseGateOverview.metrics.openDI)}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">高等级节奏风险</div>
          <div className="mt-1 text-2xl font-semibold text-rose-700">{highTimelineRiskCount}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">滞后版本</div>
          <div className="mt-1 text-2xl font-semibold">{delayedVersions}</div>
        </div>
        <div className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">不通过原因</div>
          <div className="mt-2 space-y-1 text-sm text-slate-600">
            {[...derived.releaseGateOverview.reasons, ...timelineBoard.risks.slice(0, 3).map((item) => item.reason)].slice(0, 5).map((reason) => (
              <div key={reason}>{reason}</div>
            ))}
            {!derived.releaseGateOverview.reasons.length && !timelineBoard.risks.length ? <div>当前无明显阻塞原因</div> : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function renderTeamIssueDIPanel(derived: DashboardState) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">团队问题单与 DI 视图</div>
        <div className="text-xs text-slate-500">按未关闭 DI 降序识别当前问题最重的团队，辅助评估发布评审前的质量压力。</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>团队</th>
              <th>问题总数</th>
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
                <td className={item.openDI > 5 ? "font-semibold text-rose-700" : ""}>{formatDI(item.openDI)}</td>
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
        <div className="text-xs text-slate-500">集中暴露高风险需求责任人和高风险问题单责任人，便于会中直接追责与推进。</div>
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
                    <td className="max-w-[320px]">{item.topItems.slice(0, 3).map((risk) => `${risk.itemId} ${risk.reason}`).join("；")}</td>
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
                    <td className={item.openDI > 5 ? "font-semibold text-rose-700" : ""}>{formatDI(item.openDI)}</td>
                    <td>{item.teams.join("、")}</td>
                    <td className="max-w-[320px]">{item.items.slice(0, 3).map((risk) => `${risk.itemId} ${risk.reason}`).join("；")}</td>
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
              <th>版本线</th>
              <th>版本号</th>
              <th>小迭代</th>
              <th>阶段</th>
              <th>责任人</th>
              <th>测试责任人</th>
              <th>进度</th>
              <th>风险责任人</th>
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
                <td>{item.riskOwner || item.owner || "-"}</td>
                <td>{item.onlinePlanTime || "-"}</td>
                <td className={item.risk ? "text-amber-700" : "text-slate-500"}>{item.risk || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn-secondary" disabled={derived.requirementPage.page <= 1} onClick={() => store.setReqPage(derived.requirementPage.page - 1)}>
          上一页
        </button>
        <button className="btn-secondary" disabled={derived.requirementPage.page >= derived.requirementPage.totalPages} onClick={() => store.setReqPage(derived.requirementPage.page + 1)}>
          下一页
        </button>
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
              <th>版本线</th>
              <th>版本号</th>
              <th>发现迭代</th>
              <th>严重度</th>
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
        <button className="btn-secondary" disabled={derived.issuePage.page <= 1} onClick={() => store.setIssuePage(derived.issuePage.page - 1)}>
          上一页
        </button>
        <button className="btn-secondary" disabled={derived.issuePage.page >= derived.issuePage.totalPages} onClick={() => store.setIssuePage(derived.issuePage.page + 1)}>
          下一页
        </button>
      </div>
    </section>
  );
}

export function App() {
  const store = useProjectStore();
  const derived = useMemo(() => selectDerived(store), [store]);
  const safeAuditFindings = Array.isArray(store.selfAudit?.findings) ? store.selfAudit.findings : [];
  const untrusted = useMemo(() => extractUntrustedItemIds(safeAuditFindings), [safeAuditFindings]);
  const timelineBoard = useMemo(
    () =>
      buildVersionTimelineBoardView({
        configs: seedVersionTimelineConfigs.filter((item) => {
          if (store.filters.versionLine !== "全部" && item.versionLine !== store.filters.versionLine) return false;
          if (store.filters.releaseVersion !== "全部" && item.releaseVersion !== store.filters.releaseVersion) return false;
          return true;
        }),
        requirements: derived.scopedRequirements,
        requirementRisks: derived.requirementRisks,
        issueRisks: derived.issueRisks,
        majorSummaries: derived.majorSummaries
      }),
    [derived, store.filters.releaseVersion, store.filters.versionLine]
  );

  useEffect(() => {
    if (!store.aiTransferRiskResults.length && !store.aiReleaseRiskResults.length && !store.aiLoading) {
      void store.rerunAIAnalysis({ scope: "all_files", steps: ["transfer", "release", "followup", "highlight"] });
    }
  }, [store]);

  return (
    <main className="mx-auto max-w-[1900px] space-y-4 px-4 py-4">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">版本管理双主轴驾驶舱</h1>
        <p className="text-sm text-slate-500">顶部优先呈现版本时间轴、小迭代需求推进、版本风险和发布准入，底部保留需求与问题明细。</p>
      </header>

      {store.error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <div className="flex items-center justify-between gap-3">
            <span>{store.error}</span>
            <button className="btn-secondary" onClick={store.clearError}>
              关闭
            </button>
          </div>
        </div>
      ) : null}

      {store.aiErrors.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <div className="flex items-center justify-between gap-3">
            <span>{store.aiErrors.join("；")}</span>
            <button className="btn-secondary" onClick={store.clearAIErrors}>
              关闭
            </button>
          </div>
        </div>
      ) : null}

      <SyncPanel />
      <AISummaryBanner
        recognitionCount={store.aiRecognitionResults.length}
        highlightedRequirements={store.highlightedRequirementRisks}
        highlightedIssues={store.highlightedIssueRisks}
        highlightedOwners={store.highlightedOwners}
        releaseResults={store.aiReleaseRiskResults}
      />
      <AIJobStatusPanel
        job={store.aiJob}
        busy={store.aiLoading}
        onRetryAll={() => void store.rerunAIAnalysis({ scope: store.aiJob.lastScope || "all_files" })}
        onRetryStep={(step, scope) => void store.retryAIStep(step, scope)}
      />
      <AIActionBar
        busy={store.aiLoading}
        onRunAll={(scope) => void store.rerunAIAnalysis({ scope })}
        onRunStep={(step, scope) => void store.retryAIStep(step, scope)}
      />
      <AuditSummaryBanner report={store.selfAudit.report} />
      <AuditStatusPanel
        audit={store.selfAudit}
        onRunAll={() => void store.triggerSelfAudit()}
        onRunScope={(scope) => void store.triggerPartialAudit(scope)}
        onClear={store.clearSelfAuditResult}
        onToggleEnabled={store.setSelfAuditEnabled}
      />
      <HighlightedOwners items={store.highlightedOwners} untrustedOwnerNames={untrusted.ownerNames} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <HighlightedRequirementRisks items={store.highlightedRequirementRisks} onOpen={(iterationKey) => store.setIterationFilter(iterationKey)} untrustedRequirementIds={untrusted.requirementIds} />
        <HighlightedIssueRisks
          items={store.highlightedIssueRisks}
          untrustedIssueIds={untrusted.issueIds}
          onOpen={(item) => {
            store.setVersionLineFilter(item.versionLine || "全部");
            store.setReleaseVersionFilter(item.releaseVersion || "全部");
            if (item.foundIteration) store.setIterationFilter(item.foundIteration);
          }}
        />
      </div>
      <AIRecognitionPanel items={store.aiRecognitionResults} onOverride={store.overrideRecognition} untrustedFiles={untrusted.fileNames} />
      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <AITransferRiskPanel items={store.aiTransferRiskResults} untrustedIterations={untrusted.iterationKeys} />
        <AIReleaseRiskPanel items={store.aiReleaseRiskResults} untrustedReleaseKeys={untrusted.releaseKeys} />
      </div>
      <AIFollowupPanel items={store.aiFollowupSuggestions} />
      <SelfAuditCenter audit={store.selfAudit} />
      {renderTopFilters(derived, store, timelineBoard)}
      {renderVersionTimelineBoard(store, timelineBoard)}
      {renderIterationRequirementBoard(derived)}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {renderVersionRiskPanel(timelineBoard)}
        {renderReleaseGatePanel(derived, timelineBoard)}
      </div>
      {renderMajorVersionIssueBoard(derived)}
      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        {renderTeamIssueDIPanel(derived)}
        {renderOwnerFollowupPanel(derived)}
      </div>
      {renderRequirementTable(derived, store)}
      {renderIssueTable(derived, store)}
    </main>
  );
}
