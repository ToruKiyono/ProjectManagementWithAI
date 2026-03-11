import type { Requirement } from "../../models/requirement";
import { requirementStages } from "../../models/requirement";
import { clampNumber, pickFirst, safeClone, splitTags } from "../../../utils/helpers";
import { toDateStr } from "../../../utils/date";
import { parseVersionInfo } from "./parseVersionInfo";

const stageFieldAliases: Record<string, string[]> = {
  需求基线: ["需求基线"],
  需求澄清: ["需求澄清"],
  设计文档编写: ["设计文档编写", "关联设计文档"],
  需求会签: ["需求会签", "会签"],
  需求评审: ["需求评审"],
  需求串讲: ["需求串讲"],
  "需求开发（跟进度）": ["需求开发（跟进度）", "研发进展"],
  需求转测: ["需求转测"],
  问题单清理: ["问题单清理"],
  需求上线: ["需求上线", "规划上线时间"]
};

const stageKeywords: Array<{ stage: Requirement["stage"]; keywords: string[] }> = [
  { stage: "需求上线", keywords: ["上线", "已上线", "投产"] },
  { stage: "问题单清理", keywords: ["问题单清理", "收口", "清理"] },
  { stage: "需求转测", keywords: ["转测", "测试中", "联调测试"] },
  { stage: "需求开发（跟进度）", keywords: ["开发", "研发进展", "编码", "实现"] },
  { stage: "需求串讲", keywords: ["串讲"] },
  { stage: "需求评审", keywords: ["评审"] },
  { stage: "需求会签", keywords: ["会签"] },
  { stage: "设计文档编写", keywords: ["设计文档", "设计"] },
  { stage: "需求澄清", keywords: ["澄清"] },
  { stage: "需求基线", keywords: ["基线", "待处理", "新建"] }
];

function extractStageDates(input: Record<string, unknown>): Record<string, string> {
  const stageDates: Record<string, string> = {};
  requirementStages.forEach((stage) => {
    const value = stageFieldAliases[stage].map((field) => input[field]).find(Boolean);
    stageDates[stage] = toDateStr(value);
  });
  return stageDates;
}

function inferStageFromText(value: string): Requirement["stage"] {
  const normalized = value.trim();
  if (!normalized) return "未识别阶段";
  if ((requirementStages as readonly string[]).includes(normalized)) {
    return normalized as Requirement["stage"];
  }
  const matched = stageKeywords.find((item) => item.keywords.some((keyword) => normalized.includes(keyword)));
  return matched?.stage ?? "未识别阶段";
}

export function inferRequirementStage(input: Record<string, unknown>): Requirement["stage"] {
  const directSources = [
    pickFirst(input, ["stage", "阶段"]),
    pickFirst(input, ["状态"]),
    pickFirst(input, ["研发进展"]),
    pickFirst(input, ["备注"]),
    pickFirst(input, ["验证策略"]),
    pickFirst(input, ["规划上线时间"])
  ]
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);

  for (const value of directSources) {
    const inferred = inferStageFromText(value);
    if (inferred !== "未识别阶段") return inferred;
  }

  const progressPercent = clampNumber(pickFirst(input, ["进度百分比", "progressPercent", "进度"]), 0, 100);
  const hasRisk = String(pickFirst(input, ["风险", "risk"]) || "").trim();
  const onlinePlanTime = toDateStr(pickFirst(input, ["规划上线时间", "onlinePlanTime"]));

  if (progressPercent >= 100) return "需求上线";
  if (progressPercent >= 90) return "问题单清理";
  if (progressPercent >= 75) return "需求转测";
  if (progressPercent >= 45) return "需求开发（跟进度）";
  if (progressPercent >= 30) return "需求评审";
  if (progressPercent > 0 || hasRisk || onlinePlanTime) return "需求澄清";
  return "需求基线";
}

export function normalizeRequirement(input: Record<string, unknown>, index = 0): Requirement {
  const versionInfo = parseVersionInfo(
    [
      pickFirst(input, ["迭代计划"]),
      pickFirst(input, ["发布计划"]),
      pickFirst(input, ["版本"]),
      pickFirst(input, ["Offering"]),
      pickFirst(input, ["发现版本"])
    ],
    pickFirst(input, ["需求场景", "交付场景", "versionLine", "versionScene"])
  );

  const stageDates = extractStageDates(input);
  const progressPercent = clampNumber(pickFirst(input, ["进度百分比", "progressPercent", "进度"]), 0, 100);
  const owner = String(pickFirst(input, ["责任人", "owner", "ownerName"]) || "");
  const tester = String(pickFirst(input, ["测试责任人", "tester"]) || "");
  const creator = String(pickFirst(input, ["创建人", "creator"]) || "");

  return {
    ...versionInfo,
    id: String(pickFirst(input, ["编号", "id", "reqId", "requirementId"]) || `REQ-${String(index + 1).padStart(4, "0")}`),
    title: String(pickFirst(input, ["标题", "title", "name", "描述"]) || "未命名需求"),
    type: String(pickFirst(input, ["类型", "type"]) || ""),
    status: String(pickFirst(input, ["状态", "status"]) || ""),
    stage: inferRequirementStage(input),
    owner,
    tester,
    creator,
    module: String(pickFirst(input, ["归属", "归属微服务", "module"]) || ""),
    progress: progressPercent,
    progressPercent,
    createTime: toDateStr(pickFirst(input, ["创建时间", "createTime"])),
    startDate: toDateStr(pickFirst(input, ["开始时间", "startDate"])),
    endDate: toDateStr(pickFirst(input, ["完成时间", "关闭时间", "endDate"])),
    onlinePlanTime: toDateStr(pickFirst(input, ["规划上线时间", "onlinePlanTime"])),
    workloadDay: Number(pickFirst(input, ["工作量 人·天", "前端工作量（人天）", "资料工作量（人天）"]) || 0) || 0,
    workloadMonth: Number(pickFirst(input, ["工作量 人·月"]) || 0) || 0,
    issueCount: Number(pickFirst(input, ["发现问题数量", "issueCount"]) || 0) || 0,
    tags: splitTags(pickFirst(input, ["标签", "tags"])),
    priority: String(pickFirst(input, ["优先级", "priority"]) || ""),
    category: String(pickFirst(input, ["类别", "需求分类", "附加类别", "category"]) || ""),
    risk: String(pickFirst(input, ["风险", "risk"]) || ""),
    riskOwner: owner || tester || creator,
    stageDates,
    raw: safeClone(input)
  };
}
