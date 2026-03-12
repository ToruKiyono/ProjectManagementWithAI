import { useState } from "react";
import type { AIAnalysisScope, AIStep } from "../../domain/models/ai";

type Props = {
  busy: boolean;
  onRunAll: (scope: AIAnalysisScope) => void;
  onRunStep: (step: AIStep, scope: AIAnalysisScope) => void;
};

const options: Array<{ value: AIAnalysisScope; label: string }> = [
  { value: "all_files", label: "全部文件" },
  { value: "requirement_only", label: "仅需求表" },
  { value: "issue_only", label: "仅问题单表" },
  { value: "timeline_only", label: "仅时间轴表" },
  { value: "current_iteration", label: "仅当前小迭代" },
  { value: "current_major", label: "仅当前大版本" }
];

export function AIActionBar({ busy, onRunAll, onRunStep }: Props) {
  const [scope, setScope] = useState<AIAnalysisScope>("all_files");

  function confirmAndRunAll() {
    if (!window.confirm("本次将重新覆盖当前 AI 分析结果，是否继续？")) return;
    onRunAll(scope);
  }

  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="panel-title">AI 手动触发栏</div>
          <div className="text-xs text-slate-500">支持全量分析、分步分析和范围控制。执行中按钮自动置灰。</div>
        </div>
        <div className="w-[220px]">
          <select className="input" value={scope} onChange={(event) => setScope(event.target.value as AIAnalysisScope)} disabled={busy}>
            {options.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="btn" disabled={busy} onClick={confirmAndRunAll}>手动重新分析</button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunStep("recognize", scope)}>重新识别表格</button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunStep("mapping", scope)}>重新识别字段映射</button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunStep("transfer", scope)}>重新分析转测风险</button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunStep("release", scope)}>重新分析上线风险</button>
        <button className="btn-secondary" disabled={busy} onClick={() => onRunStep("followup", scope)}>重新生成提醒对象</button>
      </div>
      {busy ? <div className="text-sm text-cyan-700">分析执行中，暂不可重复触发相同步骤。</div> : null}
    </section>
  );
}
