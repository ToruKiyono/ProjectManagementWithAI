import type { VersionSummary } from "../../domain/models/summary";

type Props = {
  value: string;
  sceneSummaries: VersionSummary[];
  majorSummaries: VersionSummary[];
  cycleSummaries: VersionSummary[];
  fullSummaries: VersionSummary[];
  syncMeta: { source: string; updatedAt: string };
  stats: {
    totalRequirements: number;
    riskRequirements: number;
    totalIssues: number;
    openIssues: number;
    currentVersionIssues: number;
    oldVersionIssues: number;
    noVersionIssues: number;
    highRiskIssues: number;
    healthScore: number;
    releaseGatePassed: boolean;
  };
  onChange: (value: string) => void;
  onClear: () => void;
};

function tokenValue(value: string, prefix: string) {
  return value.startsWith(`${prefix}:`) ? value.slice(prefix.length + 1) : "";
}

export function TopControlBar({ value, sceneSummaries, majorSummaries, cycleSummaries, fullSummaries, syncMeta, stats, onChange, onClear }: Props) {
  const selectedLine = value.startsWith("SCENE:") ? tokenValue(value, "SCENE") : (value !== "ALL" ? (sceneSummaries.find((item) => {
    if (value.startsWith("MAJOR:")) return item.versionLine === majorSummaries.find((major) => major.version === tokenValue(value, "MAJOR"))?.versionLine;
    if (value.startsWith("CYCLE:")) return item.versionLine === cycleSummaries.find((cycle) => cycle.version === tokenValue(value, "CYCLE"))?.versionLine;
    if (value.startsWith("FULL:")) return item.versionLine === fullSummaries.find((full) => full.version === tokenValue(value, "FULL"))?.versionLine;
    return false;
  })?.versionLine || "") : "");
  const releases = majorSummaries.filter((item) => !selectedLine || item.versionLine === selectedLine);
  const versions = fullSummaries.filter((item) => !selectedLine || item.versionLine === selectedLine);

  const statItems = [
    ["需求", stats.totalRequirements],
    ["风险需求", stats.riskRequirements],
    ["问题单", stats.totalIssues],
    ["未关闭", stats.openIssues],
    ["当前版本问题", stats.currentVersionIssues],
    ["旧版本问题", stats.oldVersionIssues],
    ["未关联", stats.noVersionIssues],
    ["高风险问题", stats.highRiskIssues],
    ["健康度", stats.healthScore],
    ["准入", stats.releaseGatePassed ? "通过" : "阻塞"]
  ];

  return (
    <section className="panel space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[160px] flex-1 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">版本线</div>
          <select className="input h-9 py-1.5" value={value.startsWith("SCENE:") ? value : selectedLine ? `SCENE:${selectedLine}` : "ALL"} onChange={(event) => onChange(event.target.value)}>
            <option value="ALL">全部</option>
            {sceneSummaries.map((item) => <option key={item.version} value={`SCENE:${item.version}`}>{item.versionLine}</option>)}
          </select>
        </label>
        <label className="min-w-[180px] flex-1 space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">版本号</div>
          <select className="input h-9 py-1.5" value={value.startsWith("MAJOR:") ? value : ""} onChange={(event) => onChange(event.target.value || (selectedLine ? `SCENE:${selectedLine}` : "ALL"))}>
            <option value="">全部</option>
            {releases.map((item) => <option key={item.version} value={`MAJOR:${item.version}`}>{item.releaseVersion || item.version}</option>)}
          </select>
        </label>
        <label className="min-w-[220px] flex-[1.2] space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">周期 / 完整版本</div>
          <select className="input h-9 py-1.5" value={value.startsWith("CYCLE:") || value.startsWith("FULL:") ? value : ""} onChange={(event) => onChange(event.target.value || (value.startsWith("MAJOR:") ? value : selectedLine ? `SCENE:${selectedLine}` : "ALL"))}>
            <option value="">全部</option>
            {versions.map((item) => <option key={item.version} value={`FULL:${item.version}`}>{item.fullVersion || item.releaseVersion}</option>)}
          </select>
        </label>
        <button className="btn-secondary h-9 px-3 py-1.5" onClick={onClear}>清空筛选</button>
        <div className="min-w-[260px] flex-1 text-right text-xs text-slate-500">
          <div>{syncMeta.updatedAt ? `数据时间：${syncMeta.updatedAt}` : "暂无同步时间"}</div>
          <div>{syncMeta.source ? `来源：${syncMeta.source}` : "来源未知"}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5 xl:grid-cols-10">
        {statItems.map(([label, itemValue]) => (
          <div key={String(label)} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
            <div className="text-[11px] font-medium text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-bold text-slate-800">{itemValue}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

export const renderTopControlBar = TopControlBar;
