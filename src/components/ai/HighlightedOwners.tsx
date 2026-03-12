import type { HighlightedOwner } from "../../domain/models/ai";

type Props = {
  items: HighlightedOwner[];
  untrustedOwnerNames?: Set<string>;
};

export function HighlightedOwners({ items, untrustedOwnerNames }: Props) {
  const urgent = items.filter((item) => item.bucket === "立即提醒");
  const focus = items.filter((item) => item.bucket === "重点关注");

  const renderBlock = (title: string, tone: string, rows: HighlightedOwner[]) => (
    <div className={`rounded-xl border p-4 ${tone}`}>
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-3 space-y-3">
        {rows.length ? rows.slice(0, 8).map((item) => {
          const untrusted = Boolean(untrustedOwnerNames?.has(item.name));
          return (
            <div id={`owner-${encodeURIComponent(item.name)}`} key={`${item.name}-${item.role}`} className={`rounded-lg border p-3 ${untrusted ? "border-rose-300 bg-rose-100/80" : "border-white/50 bg-white/60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="font-semibold">{item.name} / {item.role}</div>
                <div>风险 {item.riskCount} / 高风险 {item.highRiskCount} / DI {item.openIssueDI}</div>
              </div>
              {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：责任人来源存在校验问题</div> : null}
              <div className="mt-1 text-xs">所属版本: {item.versionKeys.join("；") || "-"}</div>
              <div className="mt-1 text-xs">关联项: {item.relatedItemIds.join("；")}</div>
              <div className="mt-1 text-xs">提醒原因: {item.reasons.join("；")}</div>
              <div className="mt-1 text-xs">建议动作: {item.suggestedActions.join("；")}</div>
            </div>
          );
        }) : <div className="text-sm">暂无数据</div>}
      </div>
    </div>
  );

  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">需要立即提醒的人</div>
        <div className="text-xs text-slate-500">显著展示高风险责任人、未关闭问题 DI 责任人和转测阻塞责任人。</div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {renderBlock("立即提醒", "border-rose-200 bg-rose-50 text-rose-800", urgent)}
        {renderBlock("重点关注", "border-amber-200 bg-amber-50 text-amber-800", focus)}
      </div>
    </section>
  );
}
