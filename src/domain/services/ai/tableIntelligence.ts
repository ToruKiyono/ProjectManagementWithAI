import type {
  AIConfig,
  AIFileParseCache,
  AITableType,
  FieldMappingResult,
  TableRecognitionResult,
  TableTypeDetectionPayload,
  TableTypeDetectionResult
} from "../../models/ai";
import type { IterationTimeline } from "../../models/iterationTimeline";
import type { Issue } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import { normalizeIterationTimeline } from "../normalize/normalizeIterationTimeline";
import { normalizeIssue } from "../normalize/normalizeIssue";
import { normalizeRequirement } from "../normalize/normalizeRequirement";
import { parseVersionInfo } from "../normalize/parseVersionInfo";
import { parseTabularFile } from "../sync/parseTabularFile";
import { FIELD_MAPPING_SYSTEM_PROMPT, TABLE_TYPE_SYSTEM_PROMPT } from "./prompts";
import { callAIJson } from "./provider";

type DetectionResult = {
  tableType: AITableType;
  confidence: number;
  reasoning: string;
  scoreMap: Record<AITableType, number>;
};

type MappingSemanticKey =
  | "id"
  | "title"
  | "type"
  | "status"
  | "stage"
  | "iterationPlan"
  | "owner"
  | "tester"
  | "creator"
  | "releaseVersion"
  | "versionLine"
  | "fullVersion"
  | "progressPercent"
  | "progress"
  | "risk"
  | "issueCount"
  | "onlinePlanTime"
  | "createTime"
  | "startDate"
  | "endDate"
  | "severity"
  | "team"
  | "currentOwner"
  | "devOwner"
  | "dueDate"
  | "requirementId"
  | "foundVersion"
  | "foundIteration"
  | "weekRange"
  | "dateLabel"
  | "cycleVersion"
  | "label"
  | "branch"
  | "toolkit"
  | "startTime"
  | "endTime";

const TABLE_RULES: Record<Exclude<AITableType, "unknown">, string[]> = {
  requirement: ["编号", "标题", "状态", "迭代计划", "责任人", "测试责任人", "规划上线时间", "需求场景", "研发进展", "进度百分比", "风险"],
  issue: ["问题编号", "问题标题", "问题状态", "问题阶段", "严重程度", "团队", "责任人", "测试责任人", "发现版本", "发现迭代", "承诺修复时间", "交付场景"],
  timeline: ["版本线", "版本号", "周时间", "日期", "小迭代", "说明", "开始时间", "结束时间"]
};

const FIELD_SYNONYMS: Record<AITableType, Partial<Record<MappingSemanticKey, string[]>>> = {
  requirement: {
    id: ["编号", "需求编号", "工作项编号", "reqid", "id"],
    title: ["标题", "需求标题", "名称", "需求名称"],
    type: ["类型", "需求类型"],
    status: ["状态", "需求状态"],
    stage: ["研发进展", "阶段", "当前阶段"],
    iterationPlan: ["迭代计划", "小迭代", "版本计划", "迭代", "版本迭代"],
    owner: ["责任人", "需求负责人", "owner"],
    tester: ["测试责任人", "转测负责人", "测试负责人", "tester"],
    creator: ["创建人", "提出人"],
    releaseVersion: ["发布计划", "版本号", "版本计划"],
    versionLine: ["需求场景", "版本线", "交付场景", "offering"],
    fullVersion: ["完整版本", "全版本"],
    progressPercent: ["进度百分比", "完成度", "进度%", "progresspercent"],
    progress: ["进度"],
    risk: ["风险", "风险描述", "风险项"],
    issueCount: ["发现问题数量", "问题单数量", "bug数"],
    onlinePlanTime: ["规划上线时间", "计划上线时间", "上线时间"],
    createTime: ["创建时间"],
    startDate: ["开始时间"],
    endDate: ["完成时间", "关闭时间", "结束时间"]
  },
  issue: {
    id: ["问题编号", "bug号", "bug编号", "issueid", "缺陷编号"],
    title: ["问题标题", "标题", "缺陷标题"],
    status: ["问题状态", "状态"],
    stage: ["问题阶段", "阶段"],
    severity: ["严重程度", "severity", "级别"],
    team: ["团队", "责任服务", "所属团队"],
    owner: ["责任人", "问题责任人"],
    currentOwner: ["当前责任人", "处理人"],
    tester: ["测试责任人", "验证人"],
    devOwner: ["研发责任人", "开发责任人"],
    releaseVersion: ["发布计划", "版本号"],
    versionLine: ["交付场景", "版本线", "场景"],
    fullVersion: ["迭代计划", "发现问题版本"],
    dueDate: ["承诺修复时间", "期望修复时间", "预计修复时间"],
    requirementId: ["关联工作项", "关联需求", "需求编号"],
    foundVersion: ["发现版本", "发现问题版本"],
    foundIteration: ["发现迭代", "协同迭代", "迭代"],
    createTime: ["问题创建时间", "发现时间"],
    endDate: ["问题关闭时间", "关闭时间"]
  },
  timeline: {
    versionLine: ["版本线", "大版本线", "交付场景"],
    releaseVersion: ["版本号", "版本"],
    weekRange: ["周时间", "周区间"],
    dateLabel: ["日期", "里程碑日期"],
    cycleVersion: ["小迭代", "迭代"],
    label: ["说明", "节点说明"],
    branch: ["分支"],
    toolkit: ["toolkit", "工具链版本"],
    startTime: ["开始时间"],
    endTime: ["结束时间"]
  },
  unknown: {}
};

function normalizeText(input: unknown) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[【】（）()_\-]/g, "");
}

function findHeader(headers: string[], candidates: string[]) {
  const normalizedCandidates = candidates.map(normalizeText);
  return headers.find((header) => normalizedCandidates.some((candidate) => normalizeText(header).includes(candidate)));
}

function buildScore(headers: string[], required: string[]) {
  return required.reduce((sum, field) => sum + (findHeader(headers, [field]) ? 1 : 0), 0);
}

export function detectTableTypeByHeaders(headers: string[], rows: Array<Record<string, unknown>>): DetectionResult {
  const scoreMap: Record<AITableType, number> = {
    requirement: buildScore(headers, TABLE_RULES.requirement),
    issue: buildScore(headers, TABLE_RULES.issue),
    timeline: buildScore(headers, TABLE_RULES.timeline),
    unknown: 0
  };
  const ranked = (Object.entries(scoreMap) as Array<[AITableType, number]>)
    .filter(([type]) => type !== "unknown")
    .sort((a, b) => b[1] - a[1]);
  const [bestType, bestScore] = ranked[0] ?? ["unknown", 0];
  const nextScore = ranked[1]?.[1] ?? 0;
  const confidenceBase = headers.length ? bestScore / Math.max(headers.length, 1) : 0;
  const confidence = Math.max(0, Math.min(1, confidenceBase + (bestScore - nextScore) * 0.08));
  const sampleHint = rows.slice(0, 2).some((row) => Object.values(row).some((value) => String(value).includes("B0"))) ? "样例数据包含版本/小迭代信息" : "";

  return {
    tableType: bestScore === 0 ? "unknown" : bestType,
    confidence,
    reasoning:
      bestScore === 0
        ? "规则未命中关键表头"
        : `规则命中 ${bestType} 表关键字段 ${bestScore} 个，次高命中 ${nextScore} 个。${sampleHint}`.trim(),
    scoreMap
  };
}

export async function detectTableTypeWithAI(
  fileMeta: { fileName: string },
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
  config: AIConfig
): Promise<TableTypeDetectionResult | null> {
  const payload: TableTypeDetectionPayload = {
    fileName: fileMeta.fileName,
    headers,
    sampleRows
  };
  const result = await callAIJson<TableTypeDetectionResult>(TABLE_TYPE_SYSTEM_PROMPT, payload, config);
  return result.ok ? result.data : null;
}

export const analyzeTableTypeWithAI = detectTableTypeWithAI;

export async function analyzeFieldMappingWithAI(
  tableType: AITableType,
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
  config: AIConfig
): Promise<FieldMappingResult | null> {
  const result = await callAIJson<FieldMappingResult>(
    FIELD_MAPPING_SYSTEM_PROMPT,
    { tableType, headers, sampleRows },
    config
  );
  return result.ok ? result.data : null;
}

export function inferFieldMappingByRules(tableType: AITableType, headers: string[]): FieldMappingResult {
  const synonyms = FIELD_SYNONYMS[tableType];
  const mapping: Record<string, string> = {};

  Object.entries(synonyms).forEach(([semanticKey, candidates]) => {
    const matched = findHeader(headers, candidates ?? []);
    if (matched) mapping[matched] = semanticKey;
  });

  return {
    mapping,
    confidence: headers.length ? Object.keys(mapping).length / headers.length : 0,
    reasoning: `规则映射识别到 ${Object.keys(mapping).length} 个字段`
  };
}

export async function inferFieldMappingWithAI(
  tableType: AITableType,
  headers: string[],
  sampleRows: Array<Record<string, unknown>>,
  config: AIConfig
): Promise<FieldMappingResult> {
  const ruleMapping = inferFieldMappingByRules(tableType, headers);
  const enough = Object.keys(ruleMapping.mapping).length >= Math.min(4, Math.max(2, headers.length / 4));
  if (enough || tableType === "unknown") return ruleMapping;
  const aiMapping = await analyzeFieldMappingWithAI(tableType, headers, sampleRows, config);
  if (!aiMapping) return ruleMapping;
  return {
    mapping: { ...ruleMapping.mapping, ...aiMapping.mapping },
    confidence: Math.max(ruleMapping.confidence, aiMapping.confidence),
    reasoning: [ruleMapping.reasoning, aiMapping.reasoning].filter(Boolean).join("；")
  };
}

export async function parseUploadedWorkbook(file: File): Promise<AIFileParseCache> {
  const rows = await parseTabularFile(file);
  return {
    fileName: file.name,
    rows,
    headers: Object.keys(rows[0] ?? {}),
    sampleRows: rows.slice(0, 5)
  };
}

function remapRow(row: Record<string, unknown>, mapping: Record<string, string>) {
  const remapped: Record<string, unknown> = { ...row };
  Object.entries(mapping).forEach(([sourceKey, semanticKey]) => {
    remapped[semanticKey] = row[sourceKey];
  });
  return remapped;
}

function toRequirementCanonicalRow(row: Record<string, unknown>) {
  const info = parseVersionInfo([row.fullVersion, row.iterationPlan, row.releaseVersion], row.versionLine);
  return {
    ...row,
    编号: row.id ?? row["编号"],
    标题: row.title ?? row["标题"],
    类型: row.type ?? row["类型"],
    状态: row.status ?? row["状态"],
    研发进展: row.stage ?? row["研发进展"],
    迭代计划: row.iterationPlan ?? row["迭代计划"] ?? info.fullVersion,
    责任人: row.owner ?? row["责任人"],
    测试责任人: row.tester ?? row["测试责任人"],
    创建人: row.creator ?? row["创建人"],
    发布计划: row.releaseVersion ?? row["发布计划"] ?? info.releaseVersion,
    需求场景: row.versionLine ?? row["需求场景"],
    进度百分比: row.progressPercent ?? row["进度百分比"] ?? row.progress,
    进度: row.progress ?? row["进度"] ?? row.progressPercent,
    风险: row.risk ?? row["风险"],
    发现问题数量: row.issueCount ?? row["发现问题数量"],
    规划上线时间: row.onlinePlanTime ?? row["规划上线时间"],
    创建时间: row.createTime ?? row["创建时间"],
    开始时间: row.startDate ?? row["开始时间"],
    完成时间: row.endDate ?? row["完成时间"]
  } as Record<string, unknown>;
}

function toIssueCanonicalRow(row: Record<string, unknown>) {
  const info = parseVersionInfo([row.fullVersion, row.foundIteration, row.releaseVersion, row.foundVersion], row.versionLine);
  return {
    ...row,
    问题编号: row.id ?? row["问题编号"],
    问题标题: row.title ?? row["问题标题"],
    问题状态: row.status ?? row["问题状态"],
    问题阶段: row.stage ?? row["问题阶段"],
    严重程度: row.severity ?? row["严重程度"],
    团队: row.team ?? row["团队"],
    责任人: row.owner ?? row["责任人"],
    当前责任人: row.currentOwner ?? row["当前责任人"],
    测试责任人: row.tester ?? row["测试责任人"],
    研发责任人: row.devOwner ?? row["研发责任人"],
    交付场景: row.versionLine ?? row["交付场景"],
    发布计划: row.releaseVersion ?? row["发布计划"] ?? info.releaseVersion,
    迭代计划: row.fullVersion ?? row["迭代计划"] ?? info.fullVersion,
    发现版本: row.foundVersion ?? row["发现版本"] ?? info.releaseVersion,
    发现迭代: row.foundIteration ?? row["发现迭代"] ?? info.fullVersion,
    承诺修复时间: row.dueDate ?? row["承诺修复时间"],
    关联工作项: row.requirementId ?? row["关联工作项"],
    问题创建时间: row.createTime ?? row["问题创建时间"],
    问题关闭时间: row.endDate ?? row["问题关闭时间"]
  } as Record<string, unknown>;
}

function inferMilestoneType(label: string) {
  if (label.includes("评审")) return "review";
  if (label.includes("转测")) return "transfer";
  if (label.includes("发布")) return "release";
  return "iteration";
}

function inferTransferProgress(label: string) {
  const matched = label.match(/(\d+)%/);
  return matched ? Number(matched[1]) : 0;
}

function toTimelineCanonicalRow(row: Record<string, unknown>) {
  return {
    ...row,
    版本线: row.versionLine ?? row["版本线"],
    版本号: row.releaseVersion ?? row["版本号"],
    周时间: row.weekRange ?? row["周时间"],
    日期: row.dateLabel ?? row["日期"],
    小迭代: row.cycleVersion ?? row["小迭代"],
    说明: row.label ?? row["说明"],
    分支: row.branch ?? row["分支"],
    toolkit: row.toolkit ?? row["toolkit"],
    开始时间: row.startTime ?? row["开始时间"],
    结束时间: row.endTime ?? row["结束时间"],
    milestoneType: inferMilestoneType(String(row.label ?? row["说明"] ?? "")),
    transferProgress: inferTransferProgress(String(row.label ?? row["说明"] ?? ""))
  } as Record<string, unknown>;
}

export function normalizeRequirementWithMapping(row: Record<string, unknown>, mapping: Record<string, string>, index: number): Requirement {
  return normalizeRequirement(toRequirementCanonicalRow(remapRow(row, mapping)), index);
}

export function normalizeIssueWithMapping(row: Record<string, unknown>, mapping: Record<string, string>, index: number): Issue {
  return normalizeIssue(toIssueCanonicalRow(remapRow(row, mapping)), index);
}

export function normalizeTimelineWithMapping(row: Record<string, unknown>, mapping: Record<string, string>, index: number): IterationTimeline {
  return normalizeIterationTimeline(toTimelineCanonicalRow(remapRow(row, mapping)), index);
}

export async function recognizeTable(
  parsed: AIFileParseCache,
  config: AIConfig,
  manualType?: AITableType
): Promise<TableRecognitionResult> {
  const rule = detectTableTypeByHeaders(parsed.headers, parsed.sampleRows);
  const shouldAskAI = !manualType && (rule.tableType === "unknown" || rule.confidence < 0.72 || rule.scoreMap[rule.tableType] < 4);
  const ai = shouldAskAI ? await detectTableTypeWithAI({ fileName: parsed.fileName }, parsed.headers, parsed.sampleRows, config) : null;
  const detectedType = manualType || ai?.tableType || rule.tableType;
  const source: TableRecognitionResult["source"] = manualType ? "manual" : ai ? (rule.tableType === ai.tableType ? "mixed" : "ai") : "rule";
  const mappingResult = await inferFieldMappingWithAI(detectedType, parsed.headers, parsed.sampleRows, config);

  return {
    fileName: parsed.fileName,
    rowCount: parsed.rows.length,
    headers: parsed.headers,
    sampleRows: parsed.sampleRows,
    ruleType: rule.tableType,
    detectedType: ai?.tableType || rule.tableType,
    finalType: detectedType,
    confidence: manualType ? 1 : Math.max(rule.confidence, ai?.confidence ?? 0),
    reasoning: manualType ? `用户手动指定为 ${manualType}` : [rule.reasoning, ai?.reasoning].filter(Boolean).join("；"),
    source,
    mapping: mappingResult.mapping,
    mappingConfidence: mappingResult.confidence,
    mappingReasoning: mappingResult.reasoning
  };
}
