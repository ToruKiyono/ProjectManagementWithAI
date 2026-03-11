import type { DiffResult } from "../../domain/services/compute/compareLists";
import { EmptyState } from "../common/EmptyState";

type Props = {
  requirementDiff: DiffResult<{ id: string }> | null;
  issueDiff: DiffResult<{ id: string }> | null;
};

function DiffTable({ title, diff }: { title: string; diff: DiffResult<{ id: string }> | null }) {
  if (!diff) return <EmptyState title={title} description="暂无对比数据（至少同步两次）" />;
  const rows = [
    ...diff.added.map((item) => ({ type: "新增", id: item.id, text: "-" })),
    ...diff.removed.map((item) => ({ type: "删除", id: item.id, text: "-" })),
    ...diff.changed.map((item) => ({ type: "变更", id: item.id, text: item.fields.join(", ") }))
  ];
  return (
    <div>
      <div className="mb-2 text-sm font-semibold text-slate-700">{title}</div>
      <div className="mb-2 text-sm text-slate-500">{`新增 ${diff.added.length} / 删除 ${diff.removed.length} / 变更 ${diff.changed.length}`}</div>
      {rows.length ? (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>类型</th><th>ID</th><th>说明</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.type}-${row.id}-${row.text}`}>
                  <td>{row.type}</td>
                  <td>{row.id}</td>
                  <td>{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState description="无变化" />}
    </div>
  );
}

export function DiffPanel({ requirementDiff, issueDiff }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">更新 diff 对比</div>
      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <DiffTable title="需求 diff" diff={requirementDiff} />
        <DiffTable title="问题单 diff" diff={issueDiff} />
      </div>
    </section>
  );
}
