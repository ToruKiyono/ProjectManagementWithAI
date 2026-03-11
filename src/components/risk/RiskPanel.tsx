import type { RiskRecord } from "../../domain/models/risk";
import { EmptyState } from "../common/EmptyState";

type Props = {
  risks: RiskRecord[];
};

export function RiskPanel({ risks }: Props) {
  const counts = {
    high: risks.filter((item) => item.level === "高").length,
    mid: risks.filter((item) => item.level === "中").length,
    low: risks.filter((item) => item.level === "低").length
  };

  return (
    <section className="panel">
      <div className="panel-title">风险提示</div>
      <div className="mt-3 grid gap-3 md:grid-cols-4">
        {[
          ["风险总数", risks.length],
          ["高风险", counts.high],
          ["中风险", counts.mid],
          ["低风险", counts.low]
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-bold text-slate-800">{value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        {risks.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>对象</th><th>ID</th><th>标题</th><th>责任人</th><th>版本</th><th>等级</th><th>风险说明</th></tr></thead>
              <tbody>
                {risks.map((risk) => (
                  <tr key={`${risk.type}-${risk.id}-${risk.text}`}>
                    <td>{risk.type}</td>
                    <td>{risk.itemId}</td>
                    <td title={risk.title} className="max-w-[280px] truncate">{risk.title || "-"}</td>
                    <td>{risk.owner || "-"}</td>
                    <td>{risk.version}</td>
                    <td>{risk.level}</td>
                    <td>{risk.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState description="当前范围暂无风险" />}
      </div>
    </section>
  );
}

export const renderRiskList = RiskPanel;
