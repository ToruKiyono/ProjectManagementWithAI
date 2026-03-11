import { useState } from "react";
import { Tag } from "../common/Tag";

type IssueItem = {
  id: string;
  title: string;
  severityRaw: string;
  severity: string;
  team: string;
  owner: string;
  tester: string;
  status: string;
  stage: string;
  versionRelation: "current" | "old" | "none";
  foundVersion: string;
  foundIteration: string;
  dueDate: string;
};

type Props = {
  groups: Array<{ status: string; items: IssueItem[]; highSeverityCount: number }>;
};

function relationTag(relation: IssueItem["versionRelation"]) {
  if (relation === "current") return <Tag tone="ok">关联当前版本</Tag>;
  if (relation === "old") return <Tag tone="warn">关联旧版本</Tag>;
  return <Tag tone="danger">未关联版本</Tag>;
}

export function IssueStatusBoard({ groups }: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <section className="panel">
      <div className="mb-3">
        <div className="panel-title">问题单状态管控看板</div>
        <div className="text-sm text-slate-500">按统一状态观察修复推进、版本关联和团队归属</div>
      </div>
      <div className="space-y-2">
        {visibleGroups.map((group) => {
          const collapsed = closed[group.status] ?? false;
          return (
            <div key={group.status} className="rounded-xl border border-slate-200 bg-white">
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left" onClick={() => setClosed((prev) => ({ ...prev, [group.status]: !collapsed }))}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{group.status}</span>
                  <Tag>{group.items.length} 个</Tag>
                  {group.highSeverityCount > 0 ? <Tag tone="danger">高严重 {group.highSeverityCount}</Tag> : null}
                </div>
                <span className="text-xs text-slate-500">{collapsed ? "展开" : "折叠"}</span>
              </button>
              {!collapsed ? (
                <div className="table-wrap rounded-none border-x-0 border-b-0 border-t">
                  <table className="table min-w-[1120px]">
                    <thead>
                      <tr>
                        <th>问题编号</th>
                        <th>标题</th>
                        <th>严重程度</th>
                        <th>团队</th>
                        <th>责任人</th>
                        <th>测试责任人</th>
                        <th>当前状态</th>
                        <th>当前阶段</th>
                        <th>版本关联</th>
                        <th>发现版本/迭代</th>
                        <th>承诺修复时间</th>
                        <th>超期</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => {
                        const overdue = Boolean(item.dueDate);
                        return (
                          <tr key={item.id}>
                            <td>{item.id}</td>
                            <td title={item.title} className="max-w-[260px] truncate">{item.title}</td>
                            <td>{item.severityRaw || item.severity}</td>
                            <td>{item.team || "-"}</td>
                            <td>{item.owner || "-"}</td>
                            <td>{item.tester || "-"}</td>
                            <td>{item.status}</td>
                            <td>{item.stage || "-"}</td>
                            <td>{relationTag(item.versionRelation)}</td>
                            <td>{item.foundIteration || item.foundVersion || "-"}</td>
                            <td>{item.dueDate || "-"}</td>
                            <td>{overdue ? <Tag tone="warn">关注</Tag> : <span className="text-slate-400">-</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export const renderIssueStatusBoard = IssueStatusBoard;
