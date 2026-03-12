import type { SelfAuditState } from "../../domain/models/audit";

type Props = {
  audit: SelfAuditState;
  onRunAll: () => void;
  onRunScope: (scope: "requirement" | "issue" | "timeline" | "page" | "ai") => void;
  onClear: () => void;
  onToggleEnabled: (enabled: boolean) => void;
};

export function AuditStatusPanel({ audit, onRunAll, onRunScope, onClear, onToggleEnabled }: Props) {
  const busy = ["validating_data", "validating_page", "validating_ai", "building_report"].includes(audit.status);
  const tone =
    audit.status === "error"
      ? "border-rose-200 bg-rose-50"
      : audit.status === "partial_success"
        ? "border-amber-200 bg-amber-50"
        : audit.status === "success"
          ? "border-emerald-200 bg-emerald-50"
          : "border-slate-200 bg-white";

  return (
    <section className={`panel space-y-3 ${tone}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="panel-title">自我纠察状态</div>
          <div className="text-xs text-slate-500">校验数据层、页面展示层和 AI 结果层的一致性。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" disabled={busy} onClick={onRunAll}>
            执行全量自检
          </button>
          <button className="btn-secondary" onClick={onClear}>
            清空结果
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">状态</div>
          <div className="mt-1 font-semibold">{audit.status}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">当前步骤</div>
          <div className="mt-1 font-semibold">{audit.currentStep || "-"}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">进度</div>
          <div className="mt-1 font-semibold">{audit.progressPercent}%</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">发现问题</div>
          <div className="mt-1 font-semibold">{audit.findingCount}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm">
          <div className="text-xs text-slate-500">自动自检</div>
          <label className="mt-1 flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={audit.enabled} onChange={(event) => onToggleEnabled(event.target.checked)} />
            <span>{audit.enabled ? "开启" : "关闭"}</span>
          </label>
        </div>
      </div>

      {busy ? (
        <div className="space-y-2">
          <div className="h-2 rounded-full bg-slate-200">
            <div className="h-2 rounded-full bg-cyan-500 transition-all" style={{ width: `${audit.progressPercent}%` }} />
          </div>
          <div className="text-xs text-slate-600">正在执行自检，请勿重复触发。</div>
        </div>
      ) : null}

      {audit.errors.length ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {audit.errors.join("；")}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button className="btn-secondary" disabled={busy} onClick={() => onRunScope("requirement")}>
          检查需求表
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunScope("issue")}>
          检查问题单表
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunScope("timeline")}>
          检查时间轴表
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunScope("page")}>
          检查页面展示
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunScope("ai")}>
          检查 AI 结果
        </button>
      </div>
    </section>
  );
}
