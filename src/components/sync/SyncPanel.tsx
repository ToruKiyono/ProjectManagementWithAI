import { useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useProjectStore } from "../../store/useProjectStore";

export function SyncPanel() {
  const [requirementUrl, setRequirementUrl] = useState("");
  const [issueUrl, setIssueUrl] = useState("");
  const [combinedUrl, setCombinedUrl] = useState("");
  const [legacyRequirementFile, setLegacyRequirementFile] = useState<File | null>(null);
  const [legacyIssueFile, setLegacyIssueFile] = useState<File | null>(null);
  const [legacyTimelineFile, setLegacyTimelineFile] = useState<File | null>(null);
  const [batchFiles, setBatchFiles] = useState<File[]>([]);

  const {
    loading,
    aiLoading,
    syncMeta,
    aiConfig,
    syncFromApis,
    syncFromCombined,
    syncHuawei,
    importFilesWithAI,
    setAIConfig,
    loadSeed,
    clearAIErrors
  } = useProjectStore(
    useShallow((state) => ({
      loading: state.loading,
      aiLoading: state.aiLoading,
      syncMeta: state.syncMeta,
      aiConfig: state.aiConfig,
      syncFromApis: state.syncFromApis,
      syncFromCombined: state.syncFromCombined,
      syncHuawei: state.syncHuawei,
      importFilesWithAI: state.importFilesWithAI,
      setAIConfig: state.setAIConfig,
      loadSeed: state.loadSeed,
      clearAIErrors: state.clearAIErrors
    }))
  );

  async function handleLegacyImport() {
    const files = [legacyRequirementFile, legacyIssueFile, legacyTimelineFile].filter(Boolean) as File[];
    if (files.length !== 3) return;
    clearAIErrors();
    await importFilesWithAI(files, {
      [legacyRequirementFile!.name]: "requirement",
      [legacyIssueFile!.name]: "issue",
      [legacyTimelineFile!.name]: "timeline"
    });
  }

  async function handleSmartImport() {
    if (!batchFiles.length) return;
    clearAIErrors();
    await importFilesWithAI(batchFiles);
  }

  return (
    <section className="panel space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="panel-title">数据同步、智能导入与 AI 配置</div>
          <div className="text-xs text-slate-500">保留现有 API 同步与导入能力，并新增任意表格自动识别、字段映射和 AI 风险分析。</div>
        </div>
        <div className="text-xs text-slate-500">
          {syncMeta.updatedAt ? `最近同步 ${syncMeta.updatedAt} / ${syncMeta.source}` : "尚未同步数据"}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
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
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Config</div>
          <input className="input" placeholder="AI_BASE_URL" value={aiConfig.baseUrl} onChange={(event) => setAIConfig({ baseUrl: event.target.value })} />
          <input className="input" placeholder="AI_API_KEY" value={aiConfig.apiKey} onChange={(event) => setAIConfig({ apiKey: event.target.value })} />
          <div className="grid gap-2 md:grid-cols-2">
            <input className="input" placeholder="AI_MODEL" value={aiConfig.model} onChange={(event) => setAIConfig({ model: event.target.value })} />
            <input className="input" placeholder="AI_PROVIDER_NAME" value={aiConfig.providerName} onChange={(event) => setAIConfig({ providerName: event.target.value })} />
          </div>
          <input
            className="input"
            placeholder="AI_TIMEOUT_MS"
            type="number"
            value={String(aiConfig.timeoutMs)}
            onChange={(event) => setAIConfig({ timeoutMs: Number(event.target.value) || 20000 })}
          />
        </div>

        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">AI Smart Import</div>
          <input className="input" type="file" multiple accept=".csv,.xlsx,.xls" onChange={(event) => setBatchFiles(Array.from(event.target.files ?? []))} />
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-500">
            上传任意 Excel / CSV 后，系统会自动识别为需求表、问题单表、时间轴表或未识别表，并自动触发风险分析。
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="btn" disabled={loading || aiLoading || !batchFiles.length} onClick={handleSmartImport}>智能识别并导入</button>
            <button className="btn-secondary" disabled={loading || aiLoading} onClick={loadSeed}>加载示例数据</button>
          </div>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <div className="grid gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Legacy Import</div>
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setLegacyRequirementFile(event.target.files?.[0] || null)} />
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setLegacyIssueFile(event.target.files?.[0] || null)} />
          <input className="input" type="file" accept=".csv,.xlsx,.xls" onChange={(event) => setLegacyTimelineFile(event.target.files?.[0] || null)} />
          <div className="text-[11px] text-slate-500">兼容原有三文件导入习惯，同时走统一的 AI 识别与分析流水线。</div>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" disabled={loading || aiLoading || !legacyRequirementFile || !legacyIssueFile || !legacyTimelineFile} onClick={handleLegacyImport}>
              按需求/问题单/时间轴导入
            </button>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-4 text-xs text-slate-600">
          <div className="font-semibold text-slate-800">上传后工作流</div>
          <div className="mt-2 space-y-1">
            <div>1. 读取文件并提取表头和样例行</div>
            <div>2. 规则优先识别表格类型，必要时调用 AI 二次确认</div>
            <div>3. 自动做字段映射与标准化</div>
            <div>4. 合并到 store 并自动运行转测风险、上线风险分析</div>
            <div>5. 输出识别结果、风险建议与提醒对象</div>
          </div>
        </div>
      </div>
    </section>
  );
}
