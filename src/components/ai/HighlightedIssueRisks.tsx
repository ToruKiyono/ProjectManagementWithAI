import type { HighlightedIssueRisk } from "../../domain/models/ai";

type Props = {
  items: HighlightedIssueRisk[];
  untrustedIssueIds?: Set<string>;
  onOpen?: (item: HighlightedIssueRisk) => void;
};

function tone(item: HighlightedIssueRisk, untrusted: boolean) {
  if (untrusted) return "border-rose-400 bg-rose-100";
  if (item.severity === "致命" && item.status !== "关闭") return "border-rose-300 bg-rose-50";
  if (item.severity === "严重" && item.status !== "关闭") return "border-red-200 bg-red-50";
  if (item.objectiveReasons.some((reason) => reason.includes("超"))) return "border-rose-200 bg-rose-50";
  if (item.objectiveReasons.some((reason) => reason.includes("老版本"))) return "border-amber-200 bg-amber-50";
  return "border-slate-200 bg-slate-50";
}

export function HighlightedIssueRisks({ items, untrustedIssueIds, onOpen }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">高风险问题单</div>
        <div className="text-xs text-slate-500">突出致命未关闭、严重未关闭、超期和版本阻塞问题。</div>
      </div>
      <div className="space-y-3">
        {items.length ? items.slice(0, 12).map((item) => {
          const untrusted = Boolean(untrustedIssueIds?.has(item.id));
          return (
            <button id={`issue-${item.id}`} key={item.id} type="button" onClick={() => onOpen?.(item)} className={`w-full rounded-xl border p-4 text-left ${tone(item, untrusted)}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{item.id} / {item.title}</div>
                  <div className="mt-1 text-xs text-slate-600">{item.versionLine} / {item.releaseVersion} / {item.foundIteration || "-"}</div>
                  {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：DI、版本关联或风险判断存在冲突</div> : null}
                </div>
                <div className="text-sm font-semibold">{item.riskLevel}</div>
              </div>
              <div className="mt-2 grid gap-2 text-sm text-slate-700 xl:grid-cols-4">
                <div>严重程度: {item.severity}</div>
                <div>DI: {item.di}</div>
                <div>状态 / 阶段: {item.status} / {item.stage}</div>
                <div>团队: {item.team || "-"}</div>
                <div>责任人: {item.owner || "-"}</div>
                <div>测试责任人: {item.tester || "-"}</div>
                <div>版本关联: {item.versionRelation || "-"}</div>
                <div className="xl:col-span-1">风险原因: {item.objectiveReasons.join("；") || item.aiSummary}</div>
              </div>
              <div className="mt-2 text-sm text-slate-700">建议动作: {item.suggestedActions.join("；") || "立即安排修复并回归"}</div>
            </button>
          );
        }) : <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">暂无高风险问题单。</div>}
      </div>
    </section>
  );
}
