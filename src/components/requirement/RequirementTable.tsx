import { useMemo, useState } from "react";
import type { Requirement } from "../../domain/models/requirement";
import type { Issue } from "../../domain/models/issue";
import { Pagination } from "../common/Pagination";
import { Tag } from "../common/Tag";
import { EmptyState } from "../common/EmptyState";
import { getDisplayVersion } from "../../domain/services/normalize/parseVersionInfo";

type Props = {
  items: Requirement[];
  page: number;
  totalPages: number;
  total: number;
  issues: Issue[];
  onPrev: () => void;
  onNext: () => void;
};

export function RequirementTable({ items, page, totalPages, total, issues, onPrev, onNext }: Props) {
  const [keyword, setKeyword] = useState("");
  const issueByRequirement = new Map<string, Issue[]>();
  issues.forEach((issue) => {
    const list = issueByRequirement.get(issue.requirementId) || [];
    list.push(issue);
    issueByRequirement.set(issue.requirementId, list);
  });
  const filteredItems = useMemo(() => items.filter((item) => !keyword || `${item.id} ${item.title} ${item.owner} ${item.tester}`.includes(keyword)), [items, keyword]);

  return (
    <section className="panel">
      <div className="panel-title">需求表</div>
      <div className="mt-3">
        <div className="mb-3">
          <input className="input h-9 py-1.5" placeholder="筛选需求编号 / 标题 / 责任人" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        </div>
        <Pagination page={page} totalPages={totalPages} total={total} onPrev={onPrev} onNext={onNext} />
        {filteredItems.length ? (
          <div className="table-wrap">
            <table className="table min-w-[1480px]">
              <thead>
                <tr>
                  <th>需求编号</th>
                  <th>标题</th>
                  <th>当前阶段</th>
                  <th>状态</th>
                  <th>责任人</th>
                  <th>测试责任人</th>
                  <th>风险</th>
                  <th>风险责任人</th>
                  <th>版本线</th>
                  <th>版本号</th>
                  <th>周期版本</th>
                  <th>规划上线时间</th>
                  <th>进度</th>
                  <th>版本</th>
                  <th>关联问题单</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const linkedIssues = issueByRequirement.get(item.id) || [];
                  const openCount = linkedIssues.filter((issue) => issue.status !== "关闭").length;
                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td title={item.title} className="max-w-[320px] truncate">{item.title}</td>
                      <td>{item.stage}</td>
                      <td>{item.status || "-"}</td>
                      <td>{item.owner || "-"}</td>
                      <td>{item.tester || "-"}</td>
                      <td>{item.risk ? <Tag tone="warn">{item.risk}</Tag> : "-"}</td>
                      <td>{item.riskOwner || "-"}</td>
                      <td>{item.versionLine || "-"}</td>
                      <td>{item.releaseVersion || "-"}</td>
                      <td>{item.cycleVersion || "-"}</td>
                      <td>{item.onlinePlanTime || "-"}</td>
                      <td>{item.progressPercent}%</td>
                      <td>{getDisplayVersion(item)}</td>
                      <td className="space-x-1">
                        <Tag>总 {linkedIssues.length}</Tag>
                        <Tag tone={openCount > 0 ? "warn" : "ok"}>未关闭 {openCount}</Tag>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState description="当前筛选范围暂无需求" />}
      </div>
    </section>
  );
}

export const renderRequirementTable = RequirementTable;
