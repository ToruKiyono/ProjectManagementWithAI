import type { SelfAuditReport } from "../../domain/models/audit";

type Props = {
  report: SelfAuditReport | null;
};

export function AuditSummaryBanner({ report }: Props) {
  if (!report?.summary) return null;

  const tone = report.summary.blockerCount > 0 || report.summary.highCount > 0
    ? "border-rose-200 bg-rose-50 text-rose-800"
    : report.summary.mediumCount > 0
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <section className={`rounded-2xl border px-4 py-3 ${tone}`}>
      <div className="text-sm font-semibold">自我纠察摘要</div>
      <div className="mt-1 text-sm">
        共发现 {report.summary.totalChecks} 项校验结果，blocker {report.summary.blockerCount}，high {report.summary.highCount}，
        medium {report.summary.mediumCount}，low {report.summary.lowCount}，info {report.summary.infoCount}。
      </div>
      {report.topFindings.length ? (
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          {report.topFindings.slice(0, 3).map((item) => (
            <span key={item.id} className="rounded-md border border-current/20 bg-white/60 px-2 py-1">
              {item.title}
            </span>
          ))}
        </div>
      ) : null}
    </section>
  );
}
