import { EmptyState } from "../common/EmptyState";
import { Tag } from "../common/Tag";

type TeamItem = {
  team: string;
  total: number;
  open: number;
  highRisk: number;
  items: Array<{ id: string; title: string; owner: string; tester: string; status: string; versionRelation: string }>;
};

type Props = {
  items: TeamItem[];
};

export function TeamIssuePanel({ items }: Props) {
  return (
    <section className="panel">
      <div className="panel-title">团队问题单视图</div>
      <div className="mt-1 text-sm text-slate-500">快速识别哪些团队问题单最多、未关闭最多、风险最高</div>
      <div className="mt-4 space-y-3">
        {items.length ? items.map((team) => (
          <div key={team.team} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="text-sm font-semibold text-slate-800">{team.team}</div>
                <Tag>{team.total} 个</Tag>
                <Tag tone={team.open > 0 ? "warn" : "ok"}>未关闭 {team.open}</Tag>
                <Tag tone={team.highRisk > 0 ? "danger" : "default"}>高风险 {team.highRisk}</Tag>
              </div>
            </div>
            <div className="mt-3 space-y-1">
              {team.items.slice(0, 5).map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                  {item.id} ｜ {item.status} ｜ {item.owner || item.tester || "-"} ｜ {item.versionRelation} ｜ {item.title}
                </div>
              ))}
            </div>
          </div>
        )) : <EmptyState description="当前范围暂无团队问题单数据" />}
      </div>
    </section>
  );
}

export const renderTeamIssuePanel = TeamIssuePanel;
