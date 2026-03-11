import type { Requirement } from "../../domain/models/requirement";
import { requirementStages } from "../../domain/models/requirement";
import { Pagination } from "../common/Pagination";
import { EmptyState } from "../common/EmptyState";
import { dateNum, formatDateFromMs, shortDate, todayLocalStr } from "../../utils/date";
import { getDisplayVersion } from "../../domain/services/normalize/parseVersionInfo";

type Props = {
  items: Requirement[];
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

function stageShortName(stage: string) {
  return stage.replace("需求", "").replace("（跟进度）", "").replace("问题单", "问题");
}

export function TimelinePanel({ items, page, totalPages, total, onPrev, onNext }: Props) {
  const grouped = items.reduce<Record<string, Requirement[]>>((acc, item) => {
    const key = getDisplayVersion(item);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <section className="panel">
      <div className="panel-title">时间轴</div>
      <div className="mt-3">
        <Pagination page={page} totalPages={totalPages} total={total} onPrev={onPrev} onNext={onNext} />
        {items.length ? (
          <div className="space-y-6 overflow-x-auto">
            {Object.entries(grouped).map(([version, group]) => {
              const allDates = group.flatMap((item) => requirementStages.map((stage) => dateNum(item.stageDates[stage])).filter((value): value is number => value !== null));
              const min = Math.min(...allDates);
              const max = Math.max(...allDates);
              const span = Math.max(1, max - min);
              const today = dateNum(todayLocalStr()) || min;
              const nowLeft = ((today - min) / span) * 100;
              return (
                <div key={version}>
                  <div className="mb-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{version}</div>
                  <div className="space-y-3">
                    {group.map((item) => (
                      <div key={item.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 xl:grid-cols-[300px_1fr]">
                        <div>
                          <div className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700">{item.id}</div>
                          <div className="mt-2 text-sm font-medium text-slate-800" title={item.title}>{item.title}</div>
                          <div className="mt-2 text-sm text-slate-500">{item.stage}</div>
                        </div>
                        <div className="min-w-[900px] rounded-xl border border-slate-200 bg-white p-3">
                          <div className="relative h-24">
                            <div className="absolute left-0 right-0 top-10 h-1 rounded-full bg-slate-200" />
                            <div className="absolute top-0 h-full border-l-2 border-slate-500" style={{ left: `${nowLeft}%` }}>
                              <span className="absolute -left-8 -top-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">今天</span>
                            </div>
                            {requirementStages.map((stage) => {
                              const raw = item.stageDates[stage];
                              const value = dateNum(raw);
                              if (value === null) return null;
                              const left = ((value - min) / span) * 100;
                              return (
                                <div key={`${item.id}-${stage}`}>
                                  <div className="absolute top-8 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white bg-blue-500 shadow" style={{ left: `${left}%` }} />
                                  <div className="absolute top-0 -translate-x-1/2 text-xs text-slate-600" style={{ left: `${left}%` }}>{stageShortName(stage)}</div>
                                  <div className="absolute top-14 -translate-x-1/2 text-xs text-slate-500" style={{ left: `${left}%` }}>{shortDate(raw)}</div>
                                </div>
                              );
                            })}
                          </div>
                          <div className="mt-3 flex justify-between text-xs text-slate-400">
                            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                              const date = formatDateFromMs(min + span * ratio);
                              return <span key={date}>{date}</span>;
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <EmptyState description="当前筛选范围暂无时间轴数据" />}
      </div>
    </section>
  );
}
