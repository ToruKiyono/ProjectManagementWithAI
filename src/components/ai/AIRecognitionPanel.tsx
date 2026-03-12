import type { AITableType, TableRecognitionResult } from "../../domain/models/ai";

type Props = {
  items: TableRecognitionResult[];
  onOverride: (fileName: string, tableType: AITableType) => void;
  untrustedFiles?: Set<string>;
};

const labels: Record<AITableType, string> = {
  requirement: "需求表",
  issue: "问题单表",
  timeline: "时间轴表",
  unknown: "未识别"
};

export function AIRecognitionPanel({ items, onOverride, untrustedFiles }: Props) {
  return (
    <section className="panel space-y-3">
      <div>
        <div className="panel-title">AI 导入识别结果面板</div>
        <div className="text-xs text-slate-500">显示文件识别、字段映射和低可信结果提示。</div>
      </div>
      <div className="space-y-3">
        {items.length ? (
          items.map((item) => {
            const untrusted = Boolean(untrustedFiles?.has(item.fileName));
            return (
              <div id={`recognition-${encodeURIComponent(item.fileName)}`} key={item.fileName} className={`rounded-xl border p-4 ${untrusted ? "border-rose-300 bg-rose-50/70" : "border-slate-200 bg-slate-50/70"}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">{item.fileName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      自动识别: {labels[item.finalType]} / 置信度 {(item.confidence * 100).toFixed(0)}% / 来源 {item.source}
                    </div>
                    {untrusted ? <div className="mt-1 text-xs font-semibold text-rose-700">结果待确认：识别或字段映射存在冲突</div> : null}
                  </div>
                  <select className="input max-w-[220px]" value={item.finalType} onChange={(event) => onOverride(item.fileName, event.target.value as AITableType)}>
                    {Object.entries(labels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-3 grid gap-3 xl:grid-cols-[1.2fr_1fr]">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">识别依据</div>
                    <div className="mt-2">{item.reasoning || "-"}</div>
                    <div className="mt-3 font-semibold text-slate-800">表头</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.headers.map((header) => (
                        <span key={header} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                          {header}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                    <div className="font-semibold text-slate-800">字段映射</div>
                    <div className="mt-1 text-slate-500">映射置信度 {(item.mappingConfidence * 100).toFixed(0)}%</div>
                    <div className="mt-2 space-y-1">
                      {Object.entries(item.mapping).length ? (
                        Object.entries(item.mapping).map(([source, target]) => (
                          <div key={`${source}-${target}`} className="flex items-center justify-between gap-2 rounded-md border border-slate-100 px-2 py-1">
                            <span>{source}</span>
                            <span className="text-slate-400">→</span>
                            <span className="font-medium text-slate-800">{target}</span>
                          </div>
                        ))
                      ) : (
                        <div>-</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">导入文件后会在这里展示自动识别结果。</div>
        )}
      </div>
    </section>
  );
}
