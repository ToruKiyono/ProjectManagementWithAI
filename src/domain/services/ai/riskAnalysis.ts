import type {
  AIConfig,
  AIHighlightItem,
  AIRiskLevel,
  FollowupSuggestion,
  NotifyOwner,
  ReleaseRiskAnalysis,
  ReleaseRiskAIPayload,
  TransferRiskAnalysis,
  TransferRiskAIPayload
} from "../../models/ai";
import type { IterationTimeline } from "../../models/iterationTimeline";
import type { Issue } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import { FOLLOWUP_SYSTEM_PROMPT, RELEASE_RISK_SYSTEM_PROMPT, TRANSFER_RISK_SYSTEM_PROMPT } from "./prompts";
import { callAIJson } from "./provider";

const EARLY_STAGES = ["需求基线", "需求澄清", "设计文档编写", "需求会签", "需求评审", "需求串讲"];
const CLEANUP_STAGE = "问题单清理";
const TRANSFER_STAGE = "需求转测";
const ONLINE_STATUS = "已上线";

function isClosed(issue: Issue) {
  return issue.status === "关闭";
}

function riskOrder(level: AIRiskLevel) {
  return { 无: 0, 低: 1, 中: 2, 高: 3 }[level];
}

function levelFromScore(score: number): AIRiskLevel {
  if (score >= 7) return "高";
  if (score >= 4) return "中";
  if (score > 0) return "低";
  return "无";
}

function uniqueNotifyOwners(items: NotifyOwner[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.name}-${item.role}-${item.itemId}-${item.reason}`;
    if (!item.name || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeHighlightItems(input: unknown): AIHighlightItem[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const type = record.type === "issue" || record.type === "owner" ? record.type : "requirement";
      const level = record.level === "高" || record.level === "中" || record.level === "低" ? record.level : "无";
      return {
        type,
        id: String(record.id || ""),
        title: String(record.title || ""),
        level
      } satisfies AIHighlightItem;
    })
    .filter((item): item is AIHighlightItem => Boolean(item?.id));
}

function buildRequirementNotify(item: Requirement, role: string, reason: string, suggestedAction?: string): NotifyOwner {
  return {
    name: role.includes("测试") ? item.tester : item.owner,
    role,
    sourceType: "requirement",
    itemId: item.id,
    versionKey: item.fullVersion || item.releaseVersion,
    reason,
    suggestedAction
  };
}

function buildIssueNotify(item: Issue, name: string, role: string, reason: string, suggestedAction?: string): NotifyOwner {
  return {
    name,
    role,
    sourceType: "issue",
    itemId: item.id,
    versionKey: item.fullVersion || item.releaseVersion || item.versionLine,
    reason,
    suggestedAction
  };
}

function buildRuleHighlightItemsForTransfer(requirements: Requirement[], issues: Issue[], riskLevel: AIRiskLevel): AIHighlightItem[] {
  return [
    ...requirements.slice(0, 4).map((item) => ({ type: "requirement", id: item.id, title: item.title, level: riskLevel }) satisfies AIHighlightItem),
    ...issues.slice(0, 3).map((item) => ({ type: "issue", id: item.id, title: item.title, level: riskLevel }) satisfies AIHighlightItem)
  ];
}

function buildRuleHighlightItemsForRelease(issues: Issue[], riskLevel: AIRiskLevel): AIHighlightItem[] {
  return issues.slice(0, 6).map((item) => ({ type: "issue", id: item.id, title: item.title, level: riskLevel }) satisfies AIHighlightItem);
}

function summarizeTransferRule(iterationKey: string, requirements: Requirement[], timelineNode: IterationTimeline | null, relatedIssues: Issue[]): TransferRiskAnalysis {
  const openIssues = relatedIssues.filter((item) => !isClosed(item));
  const severeOpen = openIssues.filter((item) => item.severity === "严重" || item.severity === "致命");
  const earlyRequirements = requirements.filter((item) => EARLY_STAGES.includes(item.stage));
  const explicitRiskRequirements = requirements.filter((item) => String(item.risk || "").trim());
  const transferReadyRequirements = requirements.filter((item) => item.stage === TRANSFER_STAGE || item.stage === CLEANUP_STAGE || item.status === ONLINE_STATUS);
  const milestoneLabel = String(timelineNode?.label || timelineNode?.raw["说明"] || "");

  let score = 0;
  const reasons: string[] = [];
  const blockers: string[] = [];
  const suggestedActions: string[] = [];
  const notifyOwners: NotifyOwner[] = [];

  if (requirements.length === 0) {
    return {
      iterationKey,
      versionLine: timelineNode?.versionLine ?? "",
      releaseVersion: timelineNode?.releaseVersion ?? "",
      cycleVersion: timelineNode?.cycleVersion ?? "",
      riskLevel: "无",
      summary: "当前小迭代暂无需求数据",
      reasons: [],
      blockers: [],
      suggestedActions: [],
      notifyOwners: [],
      highlightItems: [],
      confidence: 0.7,
      source: "rule",
      relatedRequirementIds: [],
      relatedIssueIds: relatedIssues.map((item) => item.id),
      metrics: {
        requirementCount: 0,
        earlyStageCount: 0,
        transferReadyRate: 0,
        openIssueCount: openIssues.length,
        severeOpenIssueCount: severeOpen.length,
        explicitRiskCount: 0
      }
    };
  }

  if (earlyRequirements.length / requirements.length >= 0.35) {
    score += 3;
    reasons.push(`仍有 ${earlyRequirements.length} 个需求停留在前期阶段`);
    blockers.push("需求成熟度不足，仍存在前期阶段需求");
    earlyRequirements.slice(0, 4).forEach((item) => {
      notifyOwners.push(buildRequirementNotify(item, "需求责任人", `${iterationKey} 临近转测，但需求仍停留在 ${item.stage}`, "补齐设计与开发收口计划"));
      if (item.tester) {
        notifyOwners.push(buildRequirementNotify(item, "测试责任人", `${iterationKey} 临近转测，需提前评估测试准备`, "确认转测门槛与缺口"));
      }
    });
  }

  const transferReadyRate = requirements.length ? transferReadyRequirements.length / requirements.length : 0;
  if (milestoneLabel.includes("转测") && transferReadyRate < 0.6) {
    score += 2;
    reasons.push(`时间轴节点已进入${milestoneLabel}，但转测成熟度仅 ${(transferReadyRate * 100).toFixed(0)}%`);
    blockers.push("时间轴节奏与实际转测成熟度不匹配");
    suggestedActions.push("按小迭代拆分待转测需求，逐条确认是否可按节点进入测试");
  }

  if (explicitRiskRequirements.length > 0) {
    score += 2;
    reasons.push(`存在 ${explicitRiskRequirements.length} 个显式风险需求`);
    blockers.push("需求显式风险未清零");
    explicitRiskRequirements.slice(0, 4).forEach((item) => {
      notifyOwners.push(buildRequirementNotify(item, "需求责任人", `${item.id} 标记了风险：${item.risk}`, "处理风险项并回填最新状态"));
    });
  }

  if (severeOpen.length > 0) {
    score += 2;
    reasons.push(`存在 ${severeOpen.length} 个严重及以上未关闭问题单`);
    blockers.push("高等级问题单仍阻塞转测");
    severeOpen.slice(0, 4).forEach((item) => {
      const reason = `${item.id} 为${item.severity}问题，当前状态 ${item.status}`;
      notifyOwners.push(buildIssueNotify(item, item.currentOwner || item.owner, "问题单责任人", reason, "尽快完成定位和修复"));
      if (item.tester) {
        notifyOwners.push(buildIssueNotify(item, item.tester, "问题单测试责任人", reason, "准备复测与回归验证"));
      }
    });
  }

  if (openIssues.length >= Math.max(4, Math.round(requirements.length * 0.6))) {
    score += 1;
    reasons.push(`关联未关闭问题单较多 (${openIssues.length})`);
    suggestedActions.push("梳理转测阻塞问题单，按严重程度和承诺时间排序处理");
  }

  const riskLevel = levelFromScore(score);
  return {
    iterationKey,
    versionLine: requirements[0]?.versionLine ?? timelineNode?.versionLine ?? "",
    releaseVersion: requirements[0]?.releaseVersion ?? timelineNode?.releaseVersion ?? "",
    cycleVersion: requirements[0]?.cycleVersion ?? timelineNode?.cycleVersion ?? "",
    riskLevel,
    summary:
      riskLevel === "无"
        ? `${iterationKey} 当前规则判断可按计划转测`
        : `${iterationKey} 存在${riskLevel}级转测风险，核心问题集中在${blockers[0] ?? reasons[0] ?? "需求成熟度"}`,
    reasons,
    blockers,
    suggestedActions: [...new Set(suggestedActions)],
    notifyOwners: uniqueNotifyOwners(notifyOwners),
    highlightItems: buildRuleHighlightItemsForTransfer([...earlyRequirements, ...explicitRiskRequirements], severeOpen, riskLevel),
    confidence: 0.78,
    source: "rule",
    relatedRequirementIds: requirements.map((item) => item.id),
    relatedIssueIds: relatedIssues.map((item) => item.id),
    metrics: {
      requirementCount: requirements.length,
      earlyStageCount: earlyRequirements.length,
      transferReadyRate: Number(transferReadyRate.toFixed(2)),
      openIssueCount: openIssues.length,
      severeOpenIssueCount: severeOpen.length,
      explicitRiskCount: explicitRiskRequirements.length
    }
  };
}

function summarizeReleaseRule(versionLine: string, releaseVersion: string, issues: Issue[], requirements: Requirement[], timelines: IterationTimeline[]): ReleaseRiskAnalysis {
  const scopedIssues = issues.filter(
    (item) =>
      item.versionLine === versionLine ||
      item.releaseVersion === releaseVersion ||
      item.foundVersion === releaseVersion ||
      (!item.versionLine && item.foundVersion === releaseVersion)
  );
  const scopedRequirements = requirements.filter((item) => item.versionLine === versionLine && (!releaseVersion || item.releaseVersion === releaseVersion));
  const openIssues = scopedIssues.filter((item) => !isClosed(item));
  const fatalOpen = openIssues.filter((item) => item.severity === "致命");
  const severeOpen = openIssues.filter((item) => item.severity === "严重");
  const overdueOpen = openIssues.filter((item) => item.dueDate && item.dueDate < new Date().toISOString().slice(0, 10));
  const oldVersionOpen = openIssues.filter((item) => item.versionLine === versionLine && item.releaseVersion && item.releaseVersion !== releaseVersion);
  const unassignedOpen = openIssues.filter((item) => !item.versionLine || (!item.releaseVersion && item.foundVersion === releaseVersion));
  const preCleanupRequirements = scopedRequirements.filter((item) => ![CLEANUP_STAGE, ONLINE_STATUS, TRANSFER_STAGE].includes(item.stage));
  const reviewNode = timelines.find((item) => item.versionLine === versionLine && item.releaseVersion === releaseVersion && String(item.label || item.raw["说明"] || "").includes("评审"));
  const teamStats = new Map<string, { openDI: number; openCount: number }>();
  const totalDI = Number(scopedIssues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1));
  const openDI = Number(openIssues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1));

  openIssues.forEach((item) => {
    const key = item.team || "未分配团队";
    const next = teamStats.get(key) ?? { openDI: 0, openCount: 0 };
    next.openDI = Number((next.openDI + item.severityScore).toFixed(1));
    next.openCount += 1;
    teamStats.set(key, next);
  });

  const riskTeams = [...teamStats.entries()].map(([team, value]) => ({ team, ...value })).sort((a, b) => b.openDI - a.openDI || b.openCount - a.openCount);

  let score = 0;
  const reasons: string[] = [];
  const blockers: string[] = [];
  const suggestedActions: string[] = [];
  const notifyOwners: NotifyOwner[] = [];

  if (fatalOpen.length > 0) {
    score += 4;
    reasons.push(`存在 ${fatalOpen.length} 个致命未关闭问题单`);
    blockers.push("致命问题单未清零");
  }
  if (severeOpen.length > 0) {
    score += 2;
    reasons.push(`存在 ${severeOpen.length} 个严重未关闭问题单`);
    blockers.push("严重问题单仍待收口");
  }
  if (openDI > 8) {
    score += 2;
    reasons.push(`未关闭问题单总 DI 为 ${openDI}，超过阈值 8`);
  }
  if (riskTeams[0] && riskTeams[0].openDI > 5) {
    score += 1;
    reasons.push(`团队 ${riskTeams[0].team} 未关闭问题单 DI 偏高 (${riskTeams[0].openDI})`);
  }
  if (overdueOpen.length > 0) {
    score += 2;
    reasons.push(`存在 ${overdueOpen.length} 个超承诺修复时间的问题单`);
    blockers.push("超期问题单未闭环");
  }
  if (unassignedOpen.length > 0) reasons.push(`存在 ${unassignedOpen.length} 个未关联版本但可能影响当前发布的问题单`);
  if (oldVersionOpen.length > 0) reasons.push(`存在 ${oldVersionOpen.length} 个老版本遗留问题仍阻塞当前版本`);
  if (reviewNode && openIssues.length > 0) reasons.push("已接近发布评审节点，但问题单仍未清理完毕");
  if (preCleanupRequirements.length >= Math.max(2, Math.round(scopedRequirements.length * 0.3))) reasons.push(`仍有 ${preCleanupRequirements.length} 个需求停留在问题单清理之前阶段`);

  fatalOpen.concat(severeOpen).slice(0, 6).forEach((item) => {
    const reason = `${item.id} 为${item.severity}未关闭问题单`;
    notifyOwners.push(buildIssueNotify(item, item.currentOwner || item.owner, "问题单责任人", reason, "立即跟进修复与验证"));
    if (item.devOwner) notifyOwners.push(buildIssueNotify(item, item.devOwner, "研发责任人", reason, "尽快提交修复并推动回归"));
    if (item.tester) notifyOwners.push(buildIssueNotify(item, item.tester, "测试责任人", reason, "确认复测窗口与回归范围"));
  });

  riskTeams.filter((item) => item.openDI > 5).slice(0, 3).forEach((item) => {
    notifyOwners.push({
      name: `${item.team}负责人`,
      role: "团队负责人",
      sourceType: "team",
      itemId: item.team,
      versionKey: `${versionLine}/${releaseVersion}`,
      reason: `${item.team} 团队未关闭问题单 DI 偏高`,
      suggestedAction: "组织团队专项收口"
    });
  });

  preCleanupRequirements.slice(0, 4).forEach((item) => {
    notifyOwners.push(buildRequirementNotify(item, "需求责任人", `${item.id} 仍停留在 ${item.stage}，影响上线收口`, "推动需求进入问题单清理或上线阶段"));
  });

  suggestedActions.push("按致命、严重、超期三个维度建立上线前清零清单");
  if (riskTeams.length > 0) {
    suggestedActions.push(`优先关注团队 ${riskTeams.slice(0, 2).map((item) => item.team).join("、")} 的问题收口`);
  }

  const riskLevel = levelFromScore(score);
  return {
    versionLine,
    releaseVersion,
    riskLevel,
    summary:
      riskLevel === "无"
        ? `${versionLine} ${releaseVersion} 当前规则判断满足上线条件`
        : `${versionLine} ${releaseVersion} 存在${riskLevel}级上线风险，重点关注${blockers[0] ?? reasons[0] ?? "问题单收口"}`,
    reasons,
    blockers,
    suggestedActions: [...new Set(suggestedActions)],
    notifyOwners: uniqueNotifyOwners(notifyOwners),
    highlightItems: buildRuleHighlightItemsForRelease(fatalOpen.concat(severeOpen, overdueOpen, oldVersionOpen, unassignedOpen), riskLevel),
    confidence: 0.8,
    source: "rule",
    totalDI,
    openDI,
    riskTeams,
    blockingIssueIds: [...new Set(fatalOpen.concat(severeOpen).map((item) => item.id))],
    relatedRequirementIds: preCleanupRequirements.map((item) => item.id)
  };
}

export function detectTransferRiskByRules(iterationSummary: { fullVersion: string; items: Requirement[] }, timelineNode: IterationTimeline | null, relatedIssues: Issue[]) {
  return summarizeTransferRule(iterationSummary.fullVersion, iterationSummary.items, timelineNode, relatedIssues);
}

export function detectReleaseRiskByRules(majorVersionSummary: { versionLine: string; releaseVersion: string }, issues: Issue[], requirements: Requirement[], timeline: IterationTimeline[]) {
  return summarizeReleaseRule(majorVersionSummary.versionLine, majorVersionSummary.releaseVersion, issues, requirements, timeline);
}

function mergeStringList(ruleValues: string[], aiValues: unknown) {
  const values = Array.isArray(aiValues) ? aiValues.map((item) => String(item || "").trim()).filter(Boolean) : [];
  return [...new Set([...ruleValues, ...values])];
}

function normalizeNotifyOwners(input: unknown): NotifyOwner[] {
  if (!Array.isArray(input)) return [];
  const result: NotifyOwner[] = [];
  input.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const record = item as Record<string, unknown>;
    const name = String(record.name || "");
    if (!name) return;
    result.push({
      name,
      role: String(record.role || ""),
      sourceType: (record.sourceType === "issue" || record.sourceType === "team" ? record.sourceType : "requirement") as NotifyOwner["sourceType"],
      itemId: String(record.itemId || ""),
      versionKey: String(record.versionKey || ""),
      reason: String(record.reason || ""),
      suggestedAction: record.suggestedAction ? String(record.suggestedAction) : undefined
    });
  });
  return result;
}

export function mergeRuleAndAIAnalysis<T extends TransferRiskAnalysis | ReleaseRiskAnalysis>(ruleResult: T, aiResult: Partial<T> | null): T {
  if (!aiResult) return ruleResult;
  const aiRiskLevel = (aiResult.riskLevel && ["高", "中", "低", "无"].includes(String(aiResult.riskLevel)) ? aiResult.riskLevel : ruleResult.riskLevel) as AIRiskLevel;
  return {
    ...ruleResult,
    riskLevel: riskOrder(aiRiskLevel) > riskOrder(ruleResult.riskLevel) ? aiRiskLevel : ruleResult.riskLevel,
    summary: String(aiResult.summary || ruleResult.summary),
    reasons: mergeStringList(ruleResult.reasons, aiResult.reasons),
    blockers: mergeStringList(ruleResult.blockers, aiResult.blockers),
    suggestedActions: mergeStringList(ruleResult.suggestedActions, aiResult.suggestedActions),
    notifyOwners: uniqueNotifyOwners([...ruleResult.notifyOwners, ...normalizeNotifyOwners(aiResult.notifyOwners)]),
    highlightItems: [...ruleResult.highlightItems, ...normalizeHighlightItems(aiResult.highlightItems)],
    confidence: Math.max(ruleResult.confidence, 0.9),
    source: "merged"
  };
}

export async function analyzeTransferRiskWithAI(payload: TransferRiskAIPayload, config: AIConfig) {
  const result = await callAIJson<Partial<TransferRiskAnalysis>>(TRANSFER_RISK_SYSTEM_PROMPT, payload, config);
  return result.ok ? result.data : null;
}

export async function analyzeReleaseRiskWithAI(payload: ReleaseRiskAIPayload, config: AIConfig) {
  const result = await callAIJson<Partial<ReleaseRiskAnalysis>>(RELEASE_RISK_SYSTEM_PROMPT, payload, config);
  return result.ok ? result.data : null;
}

export async function generateFollowupAdviceWithAI(payload: { transfer: TransferRiskAnalysis[]; release: ReleaseRiskAnalysis[] }, config: AIConfig) {
  const result = await callAIJson<{ notifyOwners: NotifyOwner[] }>(FOLLOWUP_SYSTEM_PROMPT, payload, config);
  return result.ok ? result.data?.notifyOwners ?? null : null;
}

export async function buildTransferRiskAnalysis(requirements: Requirement[], issues: Issue[], timelines: IterationTimeline[], config: AIConfig): Promise<TransferRiskAnalysis[]> {
  const groups = new Map<string, Requirement[]>();
  requirements.forEach((item) => {
    const key = item.fullVersion || item.releaseVersion;
    if (!key) return;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  });

  const analyses = await Promise.all(
    [...groups.entries()].map(async ([iterationKey, items]) => {
      const timelineNode = timelines.find((item) => item.fullVersion === iterationKey) ?? null;
      const requirementIds = new Set(items.map((item) => item.id));
      const relatedIssues = issues.filter((issue) => issue.foundIteration === iterationKey || issue.fullVersion === iterationKey || requirementIds.has(issue.requirementId));
      const ruleSummary = summarizeTransferRule(iterationKey, items, timelineNode, relatedIssues);
      const aiSummary = await analyzeTransferRiskWithAI(
        { iterationKey, requirements: items, relatedIssues, timelineNode: timelineNode?.raw ?? null, ruleSummary },
        config
      );
      return mergeRuleAndAIAnalysis(ruleSummary, aiSummary);
    })
  );

  return analyses.sort((a, b) => riskOrder(b.riskLevel) - riskOrder(a.riskLevel) || a.iterationKey.localeCompare(b.iterationKey, "zh-CN"));
}

export async function buildReleaseRiskAnalysis(requirements: Requirement[], issues: Issue[], timelines: IterationTimeline[], config: AIConfig): Promise<ReleaseRiskAnalysis[]> {
  const versions = new Map<string, { versionLine: string; releaseVersion: string }>();
  requirements.forEach((item) => {
    if (item.versionLine && item.releaseVersion) versions.set(`${item.versionLine}/${item.releaseVersion}`, { versionLine: item.versionLine, releaseVersion: item.releaseVersion });
  });
  issues.forEach((item) => {
    if (item.versionLine && item.releaseVersion) versions.set(`${item.versionLine}/${item.releaseVersion}`, { versionLine: item.versionLine, releaseVersion: item.releaseVersion });
  });

  const analyses = await Promise.all(
    [...versions.values()].map(async ({ versionLine, releaseVersion }) => {
      const ruleSummary = summarizeReleaseRule(versionLine, releaseVersion, issues, requirements, timelines);
      const aiSummary = await analyzeReleaseRiskWithAI(
        {
          versionLine,
          releaseVersion,
          requirements: requirements.filter((item) => item.versionLine === versionLine && item.releaseVersion === releaseVersion),
          issues: issues.filter((item) => item.versionLine === versionLine && item.releaseVersion === releaseVersion),
          timelines: timelines.filter((item) => item.versionLine === versionLine && item.releaseVersion === releaseVersion).map((item) => item.raw),
          ruleSummary
        },
        config
      );
      return mergeRuleAndAIAnalysis(ruleSummary, aiSummary);
    })
  );

  return analyses.sort((a, b) => riskOrder(b.riskLevel) - riskOrder(a.riskLevel) || a.versionLine.localeCompare(b.versionLine, "zh-CN"));
}

export function buildFollowupSuggestions(transfer: TransferRiskAnalysis[], release: ReleaseRiskAnalysis[]): FollowupSuggestion[] {
  const merged = uniqueNotifyOwners([...transfer.flatMap((item) => item.notifyOwners), ...release.flatMap((item) => item.notifyOwners)]);
  return merged.map((item) => {
    const [versionLine = "", releaseVersion = ""] = item.versionKey.includes("/") ? item.versionKey.split("/") : ["", item.versionKey];
    return { ...item, versionLine, releaseVersion };
  });
}
