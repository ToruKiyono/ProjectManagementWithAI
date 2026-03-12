import type { HighlightedRequirementRisk } from "../../domain/models/ai";

type Props = {
  items: HighlightedRequirementRisk[];
  onOpen: (iterationKey: string) => void;
  untrustedRequirementIds?: Set<string>;
};

function tone(level: HighlightedRequirementRisk["riskLevel"]) {
  if (level === "高") return "border-rose-200 bg-rose-50";
  if (level === "中") return "border-amber-200 bg-amber-50";
  return "border-yellow-200 bg-yellow-50";
}

export function HighlightedRequirementRisks({ items, onOpen, untrustedRequirementIds }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">高风险需求</div>
        <div className="text-xs text-slate-500">按风险等级、阶段滞后和建议动作排序展示。</div>
      </div>
      <div className="space-y-3">
        {items.length ? items.slice(0, 12).map((item) => {
          const untrusted = Boolean(untrustedRequirementIds?.has(item.id));
          return (
            <button id={`requirement-${item.id}`} key={item.id} type="button" onClick={() => onOpen(item.iterationKey)} className={`w-full rounded-xl border p-4 text-left ${untrusted ? "border-rose-400 bg-rose-100" : tone(item.riskLevel)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.id} / {item.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{item.iterationKey} / 当前阶段 {item.stage}</div>
                  {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：阶段或版本关联存在校验问题</div> : null}
                </div>
                <div className="text-sm font-semibold">{item.riskLevel}</div>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-slate-700 xl:grid-cols-4">
                <div>责任人: {item.owner || "-"}</div>
                <div>测试责任人: {item.tester || "-"}</div>
                <div className="xl:col-span-2">风险原因: {item.objectiveReasons.join("；") || item.aiSummary}</div>
              </div>
              <div className="mt-2 text-sm text-slate-700">建议动作: {item.suggestedActions.join("；") || "尽快跟进处理"}</div>
            </button>
          );
        }) : <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">暂无高风险需求。</div>}
      </div>
    </section>
  );
}
