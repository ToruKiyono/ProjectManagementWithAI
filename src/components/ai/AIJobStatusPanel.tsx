import type { AIAnalysisScope, AIJob, AIStep, AITableType } from "../../domain/models/ai";

type Props = {
  job: AIJob;
  onRetryAll: () => void;
  onRetryStep: (step: AIStep, scope?: AIAnalysisScope) => void;
  busy: boolean;
};

const stepLabels: Record<AIStep | "", string> = {
  "": "-",
  prepare: "准备数据",
  recognize: "识别表格类型",
  mapping: "识别字段映射",
  transfer: "分析转测风险",
  release: "分析上线风险",
  followup: "生成提醒对象",
  highlight: "构建高亮视图"
};

const tableLabels: Record<AITableType | "", string> = {
  "": "-",
  requirement: "需求表",
  issue: "问题单表",
  timeline: "时间轴表",
  unknown: "未识别表"
};

function tone(status: AIJob["status"]) {
  if (status === "success") return "border-emerald-200 bg-emerald-50 text-emerald-800";
  if (status === "partial_success") return "border-amber-200 bg-amber-50 text-amber-800";
  if (status === "error" || status === "timeout") return "border-rose-200 bg-rose-50 text-rose-800";
  if (status === "idle") return "border-slate-200 bg-slate-50 text-slate-700";
  return "border-cyan-200 bg-cyan-50 text-cyan-800";
}

export function AIJobStatusPanel({ job, onRetryAll, onRetryStep, busy }: Props) {
  return (
    <section className={`panel space-y-3 ${tone(job.status)}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="panel-title">AI 分析执行状态面板</div>
          <div className="text-xs opacity-80">过程可见，支持失败重试和分步重试。</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" disabled={busy} onClick={onRetryAll}>重新执行 AI 全量分析</button>
          {job.currentStep ? <button className="btn-secondary" disabled={busy} onClick={() => onRetryStep(job.currentStep as AIStep, job.lastScope)}>仅重试当前失败步骤</button> : null}
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-4">
        <div><div className="text-[11px] uppercase tracking-[0.18em] opacity-70">当前步骤</div><div className="mt-1 text-lg font-semibold">{stepLabels[job.currentStep]}</div></div>
        <div><div className="text-[11px] uppercase tracking-[0.18em] opacity-70">当前状态</div><div className="mt-1 text-lg font-semibold">{job.status}</div></div>
        <div><div className="text-[11px] uppercase tracking-[0.18em] opacity-70">当前文件</div><div className="mt-1 text-lg font-semibold">{job.currentFileName || "-"}</div></div>
        <div><div className="text-[11px] uppercase tracking-[0.18em] opacity-70">当前对象</div><div className="mt-1 text-lg font-semibold">{tableLabels[job.currentTableType]}</div></div>
      </div>
      <div className="h-2 rounded-full bg-white/70">
        <div className="h-2 rounded-full bg-current transition-all" style={{ width: `${job.progressPercent}%` }} />
      </div>
      <div className="grid gap-3 xl:grid-cols-4 text-sm">
        <div>开始时间：{job.startedAt || "-"}</div>
        <div>最近更新时间：{job.updatedAt || "-"}</div>
        <div>成功数：{job.successCount}</div>
        <div>失败数：{job.errorCount}</div>
      </div>
      {job.warnings.length ? <div className="rounded-lg border border-amber-200 bg-white/60 p-3 text-sm">{job.warnings.map((item) => <div key={item}>{item}</div>)}</div> : null}
      {job.errors.length ? <div className="rounded-lg border border-rose-200 bg-white/70 p-3 text-sm">{job.errors.map((item) => <div key={item}>{item}</div>)}</div> : null}
      <div className="text-sm font-medium">{job.completed ? `执行完成：${job.finishedAt || "-"}` : "执行中..."}</div>
    </section>
  );
}
