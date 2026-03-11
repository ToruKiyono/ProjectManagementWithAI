import { VersionCard } from "./VersionCard";
import type { VersionSummary } from "../../domain/models/summary";
import { EmptyState } from "../common/EmptyState";

type Props = {
  activeFilter: string;
  allSummary: VersionSummary;
  sceneSummaries: VersionSummary[];
  majorSummaries: VersionSummary[];
  cycleSummaries: VersionSummary[];
  onSelect: (value: string) => void;
};

export function VersionOverview({ activeFilter, allSummary, sceneSummaries, majorSummaries, cycleSummaries, onSelect }: Props) {
  const renderList = (title: string, items: VersionSummary[]) => (
    <div className="space-y-3">
      <div className="text-sm font-semibold text-slate-600">{title}</div>
      {items.length ? (
        <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <VersionCard key={`${item.scopeLevel}-${item.version}`} summary={item} selected={activeFilter === (item.scopeLevel === "ALL" ? "ALL" : `${item.scopeLevel}:${item.version}`)} onClick={() => onSelect(item.scopeLevel === "ALL" ? "ALL" : `${item.scopeLevel}:${item.version}`)} />
          ))}
        </div>
      ) : <EmptyState description="当前层级暂无版本数据" />}
    </div>
  );

  return (
    <section className="panel">
      <div className="panel-title">版本总览</div>
      <div className="mt-3 space-y-5">
        {renderList("全部版本", [allSummary])}
        {renderList("版本线", sceneSummaries)}
        {renderList("版本号", majorSummaries)}
        {renderList("周期版本", cycleSummaries)}
      </div>
    </section>
  );
}

export const renderVersionDashboard = VersionOverview;
export const renderVersionLineDashboard = VersionOverview;
export const renderReleaseVersionDashboard = VersionOverview;
