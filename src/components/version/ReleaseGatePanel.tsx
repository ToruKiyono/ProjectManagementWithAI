import type { VersionSummary } from "../../domain/models/summary";
import type { ReleaseGateOptions } from "../../domain/services/compute/checkVersionReleaseGate";

type Props = {
  summary: VersionSummary;
  options: ReleaseGateOptions;
  blockers?: {
    earlyRequirements: Array<{ id: string; title: string }>;
    cleanupRequirements: Array<{ id: string; title: string }>;
    highSeverityIssues: Array<{ id: string; title: string }>;
    oldVersionIssues: Array<{ id: string; title: string }>;
    overdueIssues: Array<{ id: string; title: string }>;
  };
  onApply: (options: Partial<ReleaseGateOptions>) => void;
};

export function ReleaseGatePanel({ summary, options, blockers, onApply }: Props) {
  return (
    <section className="panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">上线准入检查</div>
          <div className="mt-1 text-sm text-slate-500">{`${summary.versionLabel} 准入规则校验`}</div>
        </div>
        <div className={`rounded-full px-3 py-1 text-sm font-semibold ${summary.releaseGate.passed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>
          {summary.releaseGate.passed ? "通过" : "不通过"}
        </div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <label className="space-y-2">
          <span className="text-sm text-slate-500">允许未关闭问题阈值</span>
          <input className="input" type="number" min={0} value={options.maxOpenIssues} onChange={(event) => onApply({ maxOpenIssues: Number(event.target.value) })} />
        </label>
        <label className="space-y-2">
          <span className="text-sm text-slate-500">允许缺失关键阶段日期数量</span>
          <input className="input" type="number" min={0} value={options.maxMissingStageDates} onChange={(event) => onApply({ maxMissingStageDates: Number(event.target.value) })} />
        </label>
        <div className="flex items-end text-sm text-slate-500">配置变更后即时生效</div>
      </div>
      <div className="mt-4 space-y-2">
        {summary.releaseGate.reasons.length ? summary.releaseGate.reasons.map((reason) => (
          <div key={reason} className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{reason}</div>
        )) : (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">未发现阻塞当前版本上线的规则项。</div>
        )}
      </div>
      {blockers ? (
        <div className="mt-4 grid gap-3 xl:grid-cols-2">
          {([
            ["前置阶段需求", blockers.earlyRequirements],
            ["清理阶段需求", blockers.cleanupRequirements],
            ["高严重问题单", blockers.highSeverityIssues],
            ["旧版本关联问题单", blockers.oldVersionIssues],
            ["超承诺修复问题单", blockers.overdueIssues]
          ] as Array<[string, Array<{ id: string; title: string }>]>).map(([title, items]) => (
            <div key={String(title)} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
              <div className="space-y-1">
                {items.length ? items.slice(0, 6).map((item) => (
                  <div key={item.id} className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                    {item.id} ｜ {item.title}
                  </div>
                )) : <div className="text-xs text-slate-400">无阻塞项</div>}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export const renderReleaseGatePanel = ReleaseGatePanel;
