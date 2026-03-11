import { EmptyState } from "../common/EmptyState";
import { Tag } from "../common/Tag";

type RiskOwnerItem = {
  name: string;
  total: number;
  high: number;
  mid: number;
  low: number;
  teams: string[];
  requirementRisks: Array<{ itemId: string; title: string; version: string }>;
  issueRisks: Array<{ itemId: string; title: string; version: string }>;
};

type Props = {
  items: RiskOwnerItem[];
};

export function RiskOwnerPanel({ items }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">风险责任人视图</div>
      <div className="mt-1 text-sm text-slate-500">高风险优先，直观看到谁手上挂了多少风险以及属于哪个版本</div>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((item) => (
          <div key={item.name} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-800">{item.name}</div>
                <Tag tone={item.high > 0 ? "danger" : item.mid > 0 ? "warn" : "default"}>风险 {item.total}</Tag>
                <Tag tone="danger">高 {item.high}</Tag>
                <Tag tone="warn">中 {item.mid}</Tag>
                <Tag>低 {item.low}</Tag>
              </div>
              <div className="text-xs text-slate-500">{item.teams.length ? `团队：${item.teams.join(" / ")}` : "团队：-"}</div>
            </div>
            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-500">风险需求</div>
                <div className="space-y-1">
                  {item.requirementRisks.length ? item.requirementRisks.slice(0, 5).map((risk) => (
                    <div key={`${item.name}-${risk.itemId}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      {risk.itemId} ｜ {risk.version} ｜ {risk.title}
                    </div>
                  )) : <div className="text-xs text-slate-400">暂无</div>}
                </div>
              </div>
              <div>
                <div className="mb-2 text-xs font-semibold text-slate-500">风险问题单</div>
                <div className="space-y-1">
                  {item.issueRisks.length ? item.issueRisks.slice(0, 5).map((risk) => (
                    <div key={`${item.name}-${risk.itemId}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                      {risk.itemId} ｜ {risk.version} ｜ {risk.title}
                    </div>
                  )) : <div className="text-xs text-slate-400">暂无</div>}
                </div>
              </div>
            </div>
          </div>
        )) : <EmptyState description="当前范围暂无风险责任人" />}
      </div>
    </section>
  );
}

export const renderRiskOwnerPanel = RiskOwnerPanel;
