import type { Issue } from "../../models/issue";
import { issueStatuses } from "../../models/issue";
import { pickFirst, safeClone, splitTags } from "../../../utils/helpers";
import { daysBetween, toDateStr, todayLocalStr } from "../../../utils/date";
import { parseRichTextDescription } from "./parseRichTextDescription";
import { parseVersionInfo } from "./parseVersionInfo";

const severityMap: Record<string, Issue["severity"]> = {
  提示: "提示",
  低: "提示",
  LOW: "提示",
  P3: "提示",
  S3: "提示",
  一般: "一般",
  中: "一般",
  MEDIUM: "一般",
  P2: "一般",
  S2: "一般",
  严重: "严重",
  高: "严重",
  HIGH: "严重",
  P1: "严重",
  S1: "严重",
  致命: "致命",
  紧急: "致命",
  URGENT: "致命",
  CRITICAL: "致命",
  P0: "致命",
  S0: "致命"
};

const severityScoreMap: Record<Issue["severity"], number> = {
  提示: 0.1,
  一般: 1,
  严重: 3,
  致命: 5
};

export function normalizeIssueSeverity(value: unknown): Issue["severity"] {
  const raw = String(value ?? "").trim();
  const upper = raw.toUpperCase();
  if (!raw) return "一般";
  return severityMap[upper] || severityMap[raw] || "一般";
}

export function computeIssueDI(issue: Pick<Issue, "severity"> | Record<string, unknown>): number {
  const severity = "severity" in issue ? String(issue.severity) : String(pickFirst(issue, ["严重程度", "severity", "优先级"]) || "");
  return severityScoreMap[normalizeIssueSeverity(severity)];
}

export function inferIssueStatus(input: Record<string, unknown>): Issue["status"] {
  const status = String(pickFirst(input, ["问题状态", "status"]) || "");
  const stage = String(pickFirst(input, ["问题阶段", "issueStage"]) || "");
  const suspended = String(pickFirst(input, ["挂起/撤销"]) || "");
  const closeMode = String(pickFirst(input, ["关闭方式"]) || "");

  if (suspended.includes("撤销") || suspended.includes("关闭") || closeMode || status.includes("关闭")) return "关闭";
  if (stage.includes("待验收") || status.includes("验收")) return "待验收";
  if (stage.includes("已转测") || stage.includes("转测") || status.includes("已转测") || (status.includes("修复完成") && stage.includes("转测"))) return "已转测";
  if (status.includes("修复完成") || status.includes("已修复")) return "已修复";
  if (stage.includes("修改中") || status.includes("修复中") || status === "修复") return "修复中";
  if (status.includes("接纳") || status.includes("已接纳") || status.includes("分析") || stage.includes("定位") || stage.includes("分析")) return "已接纳";
  return "待确定";
}

function inferTeam(input: Record<string, unknown>): string {
  const direct = String(pickFirst(input, ["团队", "team", "责任服务"]) || "").trim();
  if (direct) return direct;
  const title = String(pickFirst(input, ["问题标题", "title"]) || "");
  const matched = title.match(/【[^】]+】\s*【([^】]+)】/);
  return matched?.[1] ?? "";
}

function parseLagDays(value: unknown): number | null {
  const matched = String(value ?? "").match(/-?\d+(\.\d+)?/);
  if (!matched) return null;
  const result = Number(matched[0]);
  return Number.isNaN(result) ? null : result;
}

export function normalizeIssue(input: Record<string, unknown>, index = 0): Issue {
  const versionInfo = parseVersionInfo(
    [
      pickFirst(input, ["发现迭代"]),
      pickFirst(input, ["迭代计划"]),
      pickFirst(input, ["迭代"]),
      pickFirst(input, ["发现版本"]),
      pickFirst(input, ["发现问题版本"]),
      pickFirst(input, ["发布计划"]),
      pickFirst(input, ["版本"])
    ],
    pickFirst(input, ["交付场景", "场景", "versionLine", "versionScene"])
  );

  const severityRaw = String(pickFirst(input, ["严重程度", "severity", "优先级"]) || "");
  const severity = normalizeIssueSeverity(severityRaw);
  const owner = String(pickFirst(input, ["责任人", "owner"]) || "");
  const currentOwner = String(pickFirst(input, ["当前责任人"]) || owner);
  const devOwner = String(pickFirst(input, ["研发责任人"]) || owner);
  const tester = String(pickFirst(input, ["测试责任人", "tester"]) || "");
  const createdAt = toDateStr(pickFirst(input, ["问题创建时间", "发现时间", "createdAt"]));
  const dueDate = toDateStr(pickFirst(input, ["承诺修复时间", "期望修复时间", "dueDate"]));
  const closeTime = toDateStr(pickFirst(input, ["问题关闭时间", "closeTime"]));
  const status = inferIssueStatus(input);

  return {
    ...versionInfo,
    id: String(pickFirst(input, ["问题编号", "id", "issueId", "bugId"]) || `BUG-${String(index + 1).padStart(4, "0")}`),
    title: String(pickFirst(input, ["问题标题", "title", "name"]) || "未命名问题单"),
    description: parseRichTextDescription(pickFirst(input, ["问题描述", "description", "结论描述"])),
    requirementId: String(pickFirst(input, ["关联工作项", "requirementId", "reqId"]) || ""),
    severity,
    severityRaw,
    severityScore: computeIssueDI({ severity }),
    owner: owner || currentOwner || devOwner || tester,
    tester,
    currentOwner,
    devOwner,
    testOwner: tester,
    team: inferTeam(input),
    status,
    stage: String(pickFirst(input, ["问题阶段", "issueStage"]) || status),
    issueStage: String(pickFirst(input, ["问题阶段", "issueStage"]) || status),
    category: String(pickFirst(input, ["问题类别", "category"]) || ""),
    priority: String(pickFirst(input, ["优先级", "priority"]) || ""),
    environment: String(pickFirst(input, ["发现环境", "environment"]) || ""),
    foundPhase: String(pickFirst(input, ["发现阶段", "foundPhase"]) || ""),
    foundWay: String(pickFirst(input, ["发现方式", "foundWay"]) || ""),
    foundSite: String(pickFirst(input, ["发现站点", "foundSite"]) || ""),
    foundService: String(pickFirst(input, ["发现服务", "foundService"]) || ""),
    affectScope: String(pickFirst(input, ["影响范围", "affectScope"]) || ""),
    rootCause: String(pickFirst(input, ["问题根因", "rootCause"]) || ""),
    conclusionSummary: String(pickFirst(input, ["结论简述", "conclusionSummary"]) || ""),
    conclusionDesc: parseRichTextDescription(pickFirst(input, ["结论描述", "conclusionDesc"])),
    solutionPlan: String(pickFirst(input, ["解决计划", "解决方案", "solutionPlan"]) || ""),
    deliveryScene: String(pickFirst(input, ["交付场景", "场景"]) || versionInfo.versionLine),
    foundVersion: String(pickFirst(input, ["发现版本", "发现问题版本"]) || versionInfo.releaseVersion),
    foundIteration: String(pickFirst(input, ["发现迭代", "协同迭代"]) || versionInfo.fullVersion),
    versionRelation: "none",
    legacyReasonAnalysis: String(pickFirst(input, ["遗留问题评审：原因分析"]) || ""),
    legacyMitigation: String(pickFirst(input, ["遗留问题评审：规避措施"]) || ""),
    legacyUserImpact: String(pickFirst(input, ["遗留问题评审：用户影响"]) || ""),
    createdAt,
    dueDate,
    acceptTime: toDateStr(pickFirst(input, ["接纳时间", "acceptTime"])),
    fixStartTime: toDateStr(pickFirst(input, ["开始修复时间", "fixStartTime"])),
    transferTestTime: toDateStr(pickFirst(input, ["转测时间", "transferTestTime"])),
    fixedTime: toDateStr(pickFirst(input, ["修复完成（测试通过）", "fixedTime"])),
    onlineTime: toDateStr(pickFirst(input, ["上线时间", "onlineTime"])),
    closeTime,
    tags: splitTags(pickFirst(input, ["标签", "tags"])),
    riskOwner: currentOwner || owner || tester,
    submitLagDays: parseLagDays(pickFirst(input, ["提交滞留时间"])),
    analysisLagDays: parseLagDays(pickFirst(input, ["定位中滞留时间"])),
    fixLagDays: parseLagDays(pickFirst(input, ["修复滞留时间"])),
    modifyLagDays: parseLagDays(pickFirst(input, ["修改中滞留时间"])),
    testLagDays: parseLagDays(pickFirst(input, ["测试滞留时间"])),
    isLegacyIssue: Boolean(pickFirst(input, ["遗留问题评审：原因分析"])) || (status !== "关闭" && createdAt ? (daysBetween(createdAt, todayLocalStr()) || 0) > 14 : false),
    raw: safeClone(input)
  };
}
