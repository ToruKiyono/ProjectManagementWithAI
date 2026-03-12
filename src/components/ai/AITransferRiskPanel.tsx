import type { TransferRiskAnalysis } from "../../domain/models/ai";

type Props = {
  items: TransferRiskAnalysis[];
  untrustedIterations?: Set<string>;
};

function tone(level: TransferRiskAnalysis["riskLevel"]) {
  if (level === "高") return "text-rose-700";
  if (level === "中") return "text-amber-700";
  if (level === "低") return "text-cyan-700";
  return "text-emerald-700";
}

export function AITransferRiskPanel({ items, untrustedIterations }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">AI 转测风险分析面板</div>
        <div className="text-xs text-slate-500">按小迭代输出规则依据、AI 总结和提醒对象。</div>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => {
            const untrusted = Boolean(untrustedIterations?.has(item.iterationKey));
            return (
              <div id={`transfer-${item.iterationKey}`} key={item.iterationKey} className={`rounded-xl border p-4 ${untrusted ? "border-rose-300 bg-rose-50/60" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.iterationKey}</div>
                    <div className="mt-1 text-xs text-slate-500">{item.versionLine} / {item.releaseVersion}</div>
                    {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：AI 结论与规则存在冲突</div> : null}
                  </div>
                  <div className={`text-sm font-semibold ${tone(item.riskLevel)}`}>{item.riskLevel}</div>
                </div>
                <div className="mt-2 text-sm text-slate-700">{item.summary}</div>
                <div className="mt-3 grid gap-3 xl:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">规则依据</div>
                    <div className="mt-2 space-y-1">{item.reasons.length ? item.reasons.map((reason) => <div key={reason}>{reason}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">阻塞对象</div>
                    <div className="mt-2 space-y-1">{item.blockers.length ? item.blockers.map((reason) => <div key={reason}>{reason}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">建议动作</div>
                    <div className="mt-2 space-y-1">{item.suggestedActions.length ? item.suggestedActions.map((reason) => <div key={reason}>{reason}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">建议提醒对象</div>
                    <div className="mt-2 space-y-1">
                      {item.notifyOwners.length ? item.notifyOwners.slice(0, 6).map((owner) => <div key={`${owner.name}-${owner.itemId}`}>{owner.name} / {owner.role}</div>) : <div>-</div>}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">导入并识别数据后会自动生成转测风险分析。</div>
        )}
      </div>
    </section>
  );
}
