import type { AuditCategory, AuditLevel, SelfAuditFinding, SelfAuditState } from "../../domain/models/audit";
import { getAuditSeverityColor } from "../../domain/services/audit/selfAudit";

type Props = {
  audit: SelfAuditState;
};

const categories: Array<{ key: AuditCategory; label: string }> = [
  { key: "requirement", label: "需求" },
  { key: "issue", label: "问题单" },
  { key: "timeline", label: "时间轴" },
  { key: "page", label: "页面展示" },
  { key: "ai", label: "AI 结果" }
];

const levels: AuditLevel[] = ["blocker", "high", "medium", "low", "info"];

function renderFinding(item: SelfAuditFinding) {
  const anchor =
    item.sourceType === "requirement" && item.itemId ? `#requirement-${item.itemId}` :
    item.sourceType === "issue" && item.itemId ? `#issue-${item.itemId}` :
    item.sourceType === "timeline" && item.itemId ? `#timeline-${item.itemId}` :
    item.sourceType === "recognition" && item.fileName ? `#recognition-${encodeURIComponent(item.fileName)}` :
    item.sourceType === "transfer-risk" && item.versionKey ? `#transfer-${item.versionKey}` :
    item.sourceType === "release-risk" && item.itemId ? `#release-${encodeURIComponent(item.itemId)}` :
    (item.sourceType === "followup" || item.sourceType === "page") && item.itemId ? `#owner-${encodeURIComponent(item.itemId)}` :
    "";
  return (
    <div key={item.id} className={`rounded-xl border p-3 ${getAuditSeverityColor(item.level)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold">{item.title}</div>
          <div className="mt-1 text-xs opacity-80">{item.checkCode}</div>
        </div>
        <div className="rounded-md border border-current/20 bg-white/60 px-2 py-1 text-xs font-semibold">
          {item.level}
        </div>
      </div>
      <div className="mt-2 text-sm">{item.message}</div>
      {anchor ? <div className="mt-2 text-xs font-medium"><a className="underline" href={anchor}>定位到相关对象</a></div> : null}
      <div className="mt-2 grid gap-2 text-xs md:grid-cols-2">
        <div>对象: {item.itemId || item.fileName || "-"}</div>
        <div>来源: {item.sourceType}</div>
        {item.expected !== undefined ? <div>期望: {item.expected || "-"}</div> : null}
        {item.actual !== undefined ? <div>实际: {item.actual || "-"}</div> : null}
      </div>
      <div className="mt-2 text-xs font-medium">建议: {item.suggestion}</div>
    </div>
  );
}

export function SelfAuditCenter({ audit }: Props) {
  const findings = Array.isArray(audit.findings) ? audit.findings : [];
  const report = audit.report;
  return (
    <section className="panel space-y-4">
      <div>
        <div className="panel-title">自我纠察中心</div>
        <div className="text-xs text-slate-500">集中展示数据层、页面层和 AI 结果层的校验发现。</div>
      </div>

      {report ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            {categories.map((category) => {
              const rows = report?.sections[category.key] ?? [];
              return (
                <details key={category.key} className="rounded-2xl border border-slate-200 bg-slate-50/60" open={category.key === "requirement" || category.key === "ai"}>
                  <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-800">
                    {category.label} ({rows.length})
                  </summary>
                  <div className="space-y-3 border-t border-slate-200 bg-white px-4 py-4">
                    {rows.length ? rows.map(renderFinding) : <div className="text-sm text-slate-500">当前分类未发现问题。</div>}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">优先处理</div>
              <div className="mt-3 space-y-3">
                {report.topFindings.length ? report.topFindings.map(renderFinding) : <div className="text-sm text-slate-500">暂无高优先级发现。</div>}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold text-slate-900">等级分布</div>
              <div className="mt-3 space-y-2">
                {levels.map((level) => {
                  const count = findings.filter((item) => item.level === level).length;
                  return (
                    <div key={level} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-sm">
                      <span>{level}</span>
                      <span className="font-semibold">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
          还没有纠察报告。导入或完成 AI 分析后可自动自检，也可以手动执行全量自检。
        </div>
      )}
    </section>
  );
}
