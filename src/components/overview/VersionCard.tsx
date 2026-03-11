import clsx from "clsx";
import type { VersionSummary } from "../../domain/models/summary";

type Props = {
  summary: VersionSummary;
  selected: boolean;
  onClick: () => void;
};

function healthClass(level: string) {
  if (level === "健康") return "bg-emerald-100 text-emerald-700";
  if (level === "关注") return "bg-amber-100 text-amber-700";
  if (level === "风险") return "bg-orange-100 text-orange-700";
  return "bg-rose-100 text-rose-700";
}

export function VersionCard({ summary, selected, onClick }: Props) {
  return (
    <button type="button" onClick={onClick} className={clsx("rounded-xl border p-4 text-left shadow-panel transition", selected ? "border-blue-500 bg-blue-50" : "border-slate-200 bg-white hover:border-slate-300")}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-800">{summary.versionLabel}</div>
          <div className="mt-1 text-sm text-slate-500">{`需求 ${summary.totalRequirements} ｜ 问题 ${summary.totalIssues}`}</div>
        </div>
        <span className={clsx("rounded-full px-2 py-1 text-xs font-semibold", healthClass(summary.healthLevel))}>{summary.healthScore} {summary.healthLevel}</span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">完成需求</div><div className="mt-1 font-semibold">{summary.completedRequirements}</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">未关闭</div><div className="mt-1 font-semibold">{summary.openIssues}</div></div>
        <div className="rounded-lg bg-slate-50 p-2"><div className="text-slate-500">风险需求</div><div className="mt-1 font-semibold">{summary.riskRequirementCount}</div></div>
      </div>
      <div className="mt-2 text-xs text-slate-500">{`风险责任人 ${summary.riskOwnersTop.slice(0, 3).map((item) => item.name).join(" / ") || "-"}`}</div>
    </button>
  );
}
