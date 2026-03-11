import { useMemo, useState } from "react";
import type { Issue } from "../../domain/models/issue";
import { Pagination } from "../common/Pagination";
import { EmptyState } from "../common/EmptyState";
import { Tag } from "../common/Tag";
import { getDisplayVersion } from "../../domain/services/normalize/parseVersionInfo";

type Props = {
  items: Issue[];
  page: number;
  totalPages: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
};

export function IssueTable({ items, page, totalPages, total, onPrev, onNext }: Props) {
  const [keyword, setKeyword] = useState("");
  const filteredItems = useMemo(() => items.filter((item) => !keyword || `${item.id} ${item.title} ${item.owner} ${item.team}`.includes(keyword)), [items, keyword]);
  return (
    <section className="panel">
      <div className="panel-title">问题单表</div>
      <div className="mt-3">
        <div className="mb-3">
          <input className="input h-9 py-1.5" placeholder="筛选问题编号 / 标题 / 团队 / 责任人" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPrev={onPrev} onNext={onNext} />
        {filteredItems.length ? (
          <div className="table-wrap">
            <table className="table min-w-[1560px]">
              <thead>
                <tr>
                  <th>问题单号</th>
                  <th>标题</th>
                  <th>版本</th>
                  <th>团队</th>
                  <th>严重级别</th>
                  <th>当前状态</th>
                  <th>当前阶段</th>
                  <th>责任人</th>
                  <th>测试责任人</th>
                  <th>版本关联</th>
                  <th>交付场景</th>
                  <th>发现版本</th>
                  <th>发现迭代</th>
                  <th>需求</th>
                  <th>承诺修复时间</th>
                  <th>是否超期</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.id}</td>
                    <td title={item.title} className="max-w-[360px] truncate">{item.title}</td>
                    <td>{getDisplayVersion(item)}</td>
                    <td>{item.team || "-"}</td>
                    <td>{item.severityRaw || item.severity}</td>
                    <td>{item.status}</td>
                    <td>{item.stage || item.issueStage || "-"}</td>
                    <td>{item.owner || item.currentOwner || "-"}</td>
                    <td>{item.tester || item.testOwner || "-"}</td>
                    <td>
                      {item.versionRelation === "current" ? <Tag tone="ok">关联当前版本</Tag> : item.versionRelation === "old" ? <Tag tone="warn">关联旧版本</Tag> : <Tag tone="danger">未关联版本</Tag>}
                    </td>
                    <td>{item.deliveryScene || item.versionLine || "-"}</td>
                    <td>{item.foundVersion || "-"}</td>
                    <td>{item.foundIteration || "-"}</td>
                    <td>{item.requirementId || "-"}</td>
                    <td>{item.dueDate || "-"}</td>
                    <td>{item.dueDate && item.status !== "关闭" ? <Tag tone="warn">关注</Tag> : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <EmptyState description="当前筛选范围暂无问题单" />}
      </div>
    </section>
  );
}

export const renderIssueTable = IssueTable;
