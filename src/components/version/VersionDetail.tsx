import type { VersionSummary } from "../../domain/models/summary";
import { EmptyState } from "../common/EmptyState";

function Distribution({ title, data, total }: { title: string; data: Record<string, number>; total: number }) {
  const entries = Object.entries(data).filter(([, count]) => count > 0);
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      <div className="space-y-2">
        {entries.length ? entries.map(([name, count]) => (
          <div key={name} className="grid grid-cols-[100px_1fr_40px] items-center gap-2 text-sm">
            <div className="truncate text-slate-600">{name}</div>
            <div className="h-2 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${total ? (count / total) * 100 : 0}%` }} />
            </div>
            <div className="text-right text-slate-700">{count}</div>
          </div>
        )) : <div className="text-sm text-slate-500">暂无数据</div>}
      </div>
    </div>
  );
}

type Props = {
  summary: VersionSummary;
  details: VersionSummary[];
};

export function VersionDetail({ summary, details }: Props) {
  return (
    <section className="panel">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="panel-title">版本详情</div>
          <div className="mt-1 text-sm text-slate-500">{`${summary.versionLabel} ｜ 当前范围内共 ${details.length} 个完整版本`}</div>
        </div>
        <div className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">{`${summary.healthScore} ${summary.healthLevel}`}</div>
      </div>
      <div className="mt-4 space-y-4">
        {details.length ? details.map((item) => (
          <div key={item.version} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-800">{item.versionLabel}</div>
                <div className="mt-1 text-sm text-slate-500">{`版本线 ${item.versionLine || "-"} ｜ 版本号 ${item.releaseVersion || "-"} ｜ 周期 ${item.cycleVersion || "-"}`}</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-700">{`${item.healthScore} ${item.healthLevel}`}</div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              {[
                ["需求总数", item.totalRequirements],
                ["完成需求", item.completedRequirements],
                ["进行中需求", item.inProgressRequirements],
                ["需求进度", `${item.requirementProgress}%`],
                ["问题总数", item.totalIssues],
                ["未关闭问题", item.openIssues],
                ["高风险问题", item.riskIssueCount],
                ["风险需求", item.riskRequirementCount],
                ["遗留问题", item.legacyIssueCount]
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className="mt-1 text-lg font-semibold text-slate-800">{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 xl:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
                <Distribution title="需求阶段分布" data={item.stageDistribution} total={item.totalRequirements} />
                <Distribution title="问题单状态分布" data={item.issueStatusDistribution} total={item.totalIssues} />
                <Distribution title="严重程度分布" data={item.severityDistribution} total={item.totalIssues} />
              </div>
              <div className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="mb-2 text-sm font-semibold text-slate-700">关键风险 Top 10</div>
                <div className="mb-3 text-xs text-slate-500">{`风险责任人：${item.riskOwnersTop.slice(0, 6).map((riskOwner) => `${riskOwner.name}(${riskOwner.count})`).join(" / ") || "-"}`}</div>
                <div className="space-y-2">
                  {item.topRisks.length ? item.topRisks.map((risk) => (
                    <div key={`${risk.type}-${risk.id}-${risk.text}`} className="rounded-lg border border-slate-200 border-l-4 border-l-rose-500 bg-slate-50 p-3 text-sm text-slate-700">
                      <div className="font-medium">{`${risk.type} ${risk.itemId}`}</div>
                      <div className="mt-1 text-slate-500">{`${risk.reason} ｜ 责任人 ${risk.owner || "-"}`}</div>
                    </div>
                  )) : <EmptyState title="当前完整版本暂无关键风险" description="风险区域会自动复用当前筛选范围" />}
                </div>
              </div>
            </div>
          </div>
        )) : <EmptyState description="当前范围内暂无完整版本数据" />}
      </div>
    </section>
  );
}
