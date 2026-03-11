import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { parseTabularFile } from "../../domain/services/sync/parseTabularFile";
import { useProjectStore } from "../../store/useProjectStore";

export function SyncPanel() {
  const [requirementUrl, setRequirementUrl] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [combinedUrl, setCombinedUrl] = useState("");
  const [requirementFile, setRequirementFile] = useState<File | null>(null);
  const [issueFile, setIssueFile] = useState<File | null>(null);
  const [timelineFile, setTimelineFile] = useState<File | null>(null);

  const { loading, syncMeta, syncFromApis, syncFromCombined, syncHuawei, importTableData, loadSeed } = useProjectStore(
    useShallow((state) => ({
      loading: state.loading,
      syncMeta: state.syncMeta,
      syncFromApis: state.syncFromApis,
      syncFromCombined: state.syncFromCombined,
      syncHuawei: state.syncHuawei,
      importTableData: state.importTableData,
      loadSeed: state.loadSeed
    }))
  );

  async function handleImport() {
    if (!requirementFile || !issueFile || !timelineFile) return;
    const [requirementRows, issueRows, timelineRows] = await Promise.all([
      parseTabularFile(requirementFile),
      parseTabularFile(issueFile),
      parseTabularFile(timelineFile)
    ]);
    importTableData(requirementRows, issueRows, timelineRows, "Excel/CSV 导入");
  }

  return (
    <section className="panel space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="panel-title">数据同步与导入</div>
          <div className="text-xs text-slate-500">保留现有 API 同步和 Excel/CSV 导入能力</div>
        </div>
        <div className="text-xs text-slate-500">
          {syncMeta.updatedAt ? `最近同步: ${syncMeta.updatedAt} / ${syncMeta.source}` : "尚未同步数据"}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">API</div>
          <input className="input" placeholder="需求接口 URL" value={requirementUrl} onChange={(event) => setRequirementUrl(event.target.value)} />
          <input className="input" placeholder="问题单接口 URL / 华为 POST URL" value={issueUrl} onChange={(event) => setIssueUrl(event.target.value)} />
          <input className="input" placeholder="单接口 URL" value={combinedUrl} onChange={(event) => setCombinedUrl(event.target.value)} />
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={loading} onClick={() => syncFromApis(requirementUrl, issueUrl)}>双接口同步</button>
            <button className="btn-secondary" disabled={loading} onClick={() => syncHuawei(issueUrl)}>华为问题单同步</button>
            <button className="btn-secondary" disabled={loading} onClick={() => syncFromCombined(combinedUrl)}>单接口同步</button>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Import</div>
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setRequirementFile(event.target.files?.[0] || null)} />
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setIssueFile(event.target.files?.[0] || null)} />
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setTimelineFile(event.target.files?.[0] || null)} />
          <div className="text-[11px] text-slate-500">导入顺序：需求表、问题单表、时间轴表。时间轴表建议字段：大版本线 / 版本号 / 小迭代 / 补丁版本 / 完整版本 / 开始时间 / 结束时间。</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={loading || !requirementFile || !issueFile || !timelineFile} onClick={handleImport}>导入三张表</button>
            <button className="btn-secondary" disabled={loading} onClick={loadSeed}>加载示例数据</button>
          </div>
        </div>
      </div>
    </section>
  );
}
