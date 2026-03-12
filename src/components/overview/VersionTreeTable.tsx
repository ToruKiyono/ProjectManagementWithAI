import { useMemo, useState } from "react";
import type { VersionSummary } from "../../domain/models/summary";
import { Tag } from "../common/Tag";

type VersionTreeNode = {
  versionLine: string;
  releases: Array<{
    releaseVersion: string;
    cycles: VersionSummary[];
  }>;
};

type Props = {
  tree: VersionTreeNode[];
  onSelect: (value: string) => void;
};

type SortKey = "risk" | "open" | "health";

export function VersionTreeTable({ tree, onSelect }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("risk");

  const sorted = useMemo(() => {
    return tree.map((line) => ({
      ...line,
      releases: [...line.releases]
        .map((release) => ({
          ...release,
          cycles: [...release.cycles].sort((a, b) => {
            if (sortKey === "health") return a.healthScore - b.healthScore || b.highRiskCount - a.highRiskCount;
            if (sortKey === "open") return b.openIssues - a.openIssues || b.highRiskCount - a.highRiskCount;
            return b.highRiskCount - a.highRiskCount || b.openIssues - a.openIssues || a.healthScore - b.healthScore;
          })
        }))
        .sort((a, b) => a.releaseVersion.localeCompare(b.releaseVersion, "zh-CN"))
    }));
  }, [sortKey, tree]);

  return (
    <section className="panel">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <div className="panel-title">版本总览表</div>
          <div className="text-sm text-slate-500">版本线 &gt; 版本号 &gt; 周期版本，默认按风险排序</div>
        </div>
        <select className="input max-w-[180px] h-9 py-1.5" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
          <option value="risk">按风险数排序</option>
          <option value="open">按未关闭问题排序</option>
          <option value="health">按健康度排序</option>
        </select>
      </div>
      <div className="space-y-2">
        {sorted.map((line) => (
          <details key={line.versionLine} open className="rounded-xl border border-slate-200 bg-slate-50">
            <summary className="cursor-pointer list-none px-3 py-2 text-sm font-semibold text-slate-800">{line.versionLine}</summary>
            <div className="space-y-2 px-2 pb-2">
              {line.releases.map((release) => (
                <details key={`${line.versionLine}-${release.releaseVersion}`} open className="rounded-lg border border-slate-200 bg-white">
                  <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-700">{release.releaseVersion}</summary>
                  <div className="table-wrap rounded-none border-x-0 border-b-0 border-t">
                    <table className="table min-w-[1320px]">
                      <thead>
                        <tr>
                          <th>版本线</th>
                          <th>版本号</th>
                          <th>周期版本</th>
                          <th>需求总数</th>
                          <th>开发中</th>
                          <th>转测中</th>
                          <th>已上线</th>
                          <th>风险需求</th>
                          <th>问题单</th>
                          <th>修复中</th>
                          <th>待验收</th>
                          <th>未关闭</th>
                          <th>旧版本问题</th>
                          <th>未关联</th>
                          <th>团队数</th>
                          <th>风险责任人数</th>
                          <th>健康度</th>
                          <th>准入</th>
                        </tr>
                      </thead>
                      <tbody>
                        {release.cycles.map((item) => (
                          <tr key={item.versionKey} className={item.highRiskCount > 0 ? "bg-rose-50/50" : ""}>
                            <td>{item.versionLine}</td>
                            <td>{item.releaseVersion || "-"}</td>
                            <td>
                              <button type="button" className="text-left text-blue-700 hover:underline" onClick={() => onSelect(`FULL:${item.version}`)}>
                                {item.fullVersion || item.releaseVersion || "-"}
                              </button>
                            </td>
                            <td>{item.totalRequirements}</td>
                            <td>{item.stageDistribution["需求开发"] || 0}</td>
                            <td>{item.stageDistribution["需求转测"] || 0}</td>
                            <td>{item.onlineRequirements}</td>
                            <td>{item.riskRequirementCount}</td>
                            <td>{item.totalIssues}</td>
                            <td>{item.issueStatusDistribution["修复中"] || 0}</td>
                            <td>{item.issueStatusDistribution["待验收"] || 0}</td>
                            <td>{item.openIssues}</td>
                            <td>{item.issues.filter((issue) => issue.versionLine && issue.releaseVersion && (issue.releaseVersion !== item.releaseVersion || (item.cycleVersion && issue.cycleVersion && issue.cycleVersion !== item.cycleVersion))).length}</td>
                            <td>{item.issues.filter((issue) => !issue.versionLine || !issue.releaseVersion).length}</td>
                            <td>{new Set(item.issues.map((issue) => issue.team).filter(Boolean)).size}</td>
                            <td>{item.riskOwnersTop.length}</td>
                            <td><Tag tone={item.healthScore < 70 ? "warn" : "ok"}>{item.healthScore}</Tag></td>
                            <td>{item.releaseGate.passed ? <Tag tone="ok">通过</Tag> : <Tag tone="danger">阻塞</Tag>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

export const renderVersionTreeTable = VersionTreeTable;
