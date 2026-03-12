import type { ReleaseRiskAnalysis } from "../../domain/models/ai";

type Props = {
  items: ReleaseRiskAnalysis[];
  untrustedReleaseKeys?: Set<string>;
};

function tone(level: ReleaseRiskAnalysis["riskLevel"]) {
  if (level === "高") return "text-rose-700";
  if (level === "中") return "text-amber-700";
  if (level === "低") return "text-cyan-700";
  return "text-emerald-700";
}

export function AIReleaseRiskPanel({ items, untrustedReleaseKeys }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">AI 上线风险分析面板</div>
        <div className="text-xs text-slate-500">按大版本输出上线风险、DI、风险团队和建议跟进对象。</div>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => {
            const releaseKey = `${item.versionLine}/${item.releaseVersion}`;
            const untrusted = Boolean(untrustedReleaseKeys?.has(releaseKey));
            return (
              <div id={`release-${encodeURIComponent(releaseKey)}`} key={releaseKey} className={`rounded-xl border p-4 ${untrusted ? "border-rose-300 bg-rose-50/60" : "border-slate-200 bg-white"}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{releaseKey}</div>
                    <div className="mt-1 text-xs text-slate-500">总 DI {item.totalDI} / 未关闭 DI {item.openDI}</div>
                    {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：AI 结论与规则存在冲突</div> : null}
                  </div>
                  <div className={`text-sm font-semibold ${tone(item.riskLevel)}`}>{item.riskLevel}</div>
                </div>
                <div className="mt-2 text-sm text-slate-700">{item.summary}</div>
                <div className="mt-3 grid gap-3 xl:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">规则依据</div>
                    <div className="mt-2 space-y-1">{item.reasons.length ? item.reasons.map((reason) => <div key={reason}>{reason}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">风险团队</div>
                    <div className="mt-2 space-y-1">{item.riskTeams.length ? item.riskTeams.slice(0, 4).map((team) => <div key={team.team}>{team.team} / DI {team.openDI} / 未关闭 {team.openCount}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">阻塞问题单</div>
                    <div className="mt-2 space-y-1">{item.blockingIssueIds.length ? item.blockingIssueIds.slice(0, 6).map((id) => <div key={id}>{id}</div>) : <div>-</div>}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">建议提醒对象</div>
                    <div className="mt-2 space-y-1">{item.notifyOwners.length ? item.notifyOwners.slice(0, 6).map((owner) => <div key={`${owner.name}-${owner.itemId}`}>{owner.name} / {owner.role}</div>) : <div>-</div>}</div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">导入问题单和需求后会在这里生成上线风险分析。</div>
        )}
      </div>
    </section>
  );
}
