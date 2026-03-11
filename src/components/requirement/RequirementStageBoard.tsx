import { useState } from "react";
import { Tag } from "../common/Tag";

type RequirementItem = {
  id: string;
  title: string;
  owner: string;
  tester: string;
  progressPercent: number;
  risk: string;
  riskOwner: string;
  onlinePlanTime: string;
  fullVersion: string;
};

type Props = {
  groups: Array<{ stage: string; items: RequirementItem[]; riskCount: number }>;
};

function stageTone(riskCount: number) {
  if (riskCount >= 3) return "border-rose-300 bg-rose-50";
  if (riskCount > 0) return "border-amber-300 bg-amber-50";
  return "border-slate-200 bg-white";
}

export function RequirementStageBoard({ groups }: Props) {
  const [closed, setClosed] = useState<Record<string, boolean>>({});
  const visibleGroups = groups.filter((group) => group.items.length > 0);

  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="panel-title">需求阶段推进看板</div>
          <div className="text-sm text-slate-500">按固定阶段顺序观察需求卡点、责任人和上线计划</div>
        </div>
      </div>
      <div className="space-y-2">
        {visibleGroups.map((group) => {
          const collapsed = closed[group.stage] ?? false;
          return (
            <div key={group.stage} className={`rounded-xl border ${stageTone(group.riskCount)}`}>
              <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left" onClick={() => setClosed((prev) => ({ ...prev, [group.stage]: !collapsed }))}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-800">{group.stage}</span>
                  <Tag>{group.items.length} 条</Tag>
                  {group.riskCount > 0 ? <Tag tone="warn">风险 {group.riskCount}</Tag> : null}
                </div>
                <span className="text-xs text-slate-500">{collapsed ? "展开" : "折叠"}</span>
              </button>
              {!collapsed ? (
                <div className="table-wrap rounded-none border-x-0 border-b-0 border-t">
                  <table className="table min-w-[980px]">
                    <thead>
                      <tr>
                        <th>编号</th>
                        <th>标题</th>
                        <th>责任人</th>
                        <th>测试责任人</th>
                        <th>进度</th>
                        <th>风险</th>
                        <th>风险责任人</th>
                        <th>规划上线时间</th>
                        <th>所属版本</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td title={item.title} className="max-w-[260px] truncate">{item.title}</td>
                          <td>{item.owner || "-"}</td>
                          <td>{item.tester || "-"}</td>
                          <td>
                            <div className="w-24">
                              <div className="h-1.5 rounded-full bg-slate-200">
                                <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${item.progressPercent}%` }} />
                              </div>
                              <div className="mt-1 text-[11px] text-slate-500">{item.progressPercent}%</div>
                            </div>
                          </td>
                          <td>{item.risk ? <Tag tone="danger">风险</Tag> : <span className="text-slate-400">-</span>}</td>
                          <td>{item.riskOwner || "-"}</td>
                          <td>{item.onlinePlanTime || "-"}</td>
                          <td>{item.fullVersion || "-"}</td>
                        </tr>
                      ))}
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

export const renderRequirementStageBoard = RequirementStageBoard;
