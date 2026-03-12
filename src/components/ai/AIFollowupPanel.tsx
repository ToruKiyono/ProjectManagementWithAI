import type { FollowupSuggestion } from "../../domain/models/ai";

type Props = {
  items: FollowupSuggestion[];
};

export function AIFollowupPanel({ items }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">AI 提醒对象面板</div>
        <div className="text-xs text-slate-500">按责任人聚合展示来源、所属版本、风险原因和建议动作，便于后续接入通知系统。</div>
      </div>
      <div className="table-wrap">
        <table className="table text-[12px]">
          <thead>
            <tr>
              <th>责任人</th>
              <th>角色</th>
              <th>来源</th>
              <th>所属版本</th>
              <th>工作项</th>
              <th>风险原因</th>
              <th>建议动作</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={`${item.name}-${item.itemId}-${item.reason}`}>
                  <td className="font-medium text-slate-800">{item.name}</td>
                  <td>{item.role}</td>
                  <td>{item.sourceType}</td>
                  <td>{item.versionLine ? `${item.versionLine} / ${item.releaseVersion}` : item.releaseVersion || "-"}</td>
                  <td>{item.itemId}</td>
                  <td className="max-w-[360px]">{item.reason}</td>
                  <td>{item.suggestedAction || "-"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center text-slate-500">暂无提醒对象</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
