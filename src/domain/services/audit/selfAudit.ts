import type {
  FileFieldMappingResult,
  FollowupSuggestion,
  HighlightedIssueRisk,
  HighlightedOwner,
  HighlightedRequirementRisk,
  ReleaseRiskAnalysis,
  TableRecognitionResult,
  TransferRiskAnalysis
} from "../../models/ai";
import type { AuditCategory, AuditLevel, SelfAuditFinding, SelfAuditReport } from "../../models/audit";
import type { Issue } from "../../models/issue";
import type { IterationTimeline } from "../../models/iterationTimeline";
import type { Requirement } from "../../models/requirement";
import { computeIssueVersionRelation } from "../compute/management";

type DerivedSnapshot = {
  scopedRequirements: Requirement[];
  scopedIssues: Issue[];
  scopedTimelines: IterationTimeline[];
  requirementRisks: Array<{ itemId: string; level: string; owner: string; reason: string }>;
  issueRisks: Array<{ itemId: string; level: string; owner: string; reason: string }>;
  topStats: {
    requirementCount: number;
    issueCount: number;
    totalDI: number;
    openDI: number;
  };
};

export type SelfAuditInput = {
  requirements: Requirement[];
  issues: Issue[];
  timelines: IterationTimeline[];
  derived: DerivedSnapshot;
  recognitionResults: TableRecognitionResult[];
  fieldMappings: FileFieldMappingResult[];
  transferResults: TransferRiskAnalysis[];
  releaseResults: ReleaseRiskAnalysis[];
  followups: FollowupSuggestion[];
  highlightedRequirementRisks: HighlightedRequirementRisk[];
  highlightedIssueRisks: HighlightedIssueRisk[];
  highlightedOwners: HighlightedOwner[];
  currentContext: {
    versionLine: string;
    releaseVersion: string;
    iteration: string;
  };
};

const allCategories: AuditCategory[] = ["requirement", "issue", "timeline", "page", "ai"];

const levelWeight: Record<AuditLevel, number> = {
  blocker: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

function createFinding(input: Omit<SelfAuditFinding, "id">): SelfAuditFinding {
  return {
    id: `${input.category}:${input.checkCode}:${input.itemId || input.fileName || input.message}`,
    ...input
  };
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

function getTimelineKey(item: { versionLine?: string; releaseVersion?: string; fullVersion?: string; cycleVersion?: string }) {
  return `${item.versionLine || ""}/${item.fullVersion || (item.releaseVersion && item.cycleVersion ? `${item.releaseVersion}-${item.cycleVersion}` : item.releaseVersion || "")}`;
}

function validateRequirements(requirements: Requirement[], timelines: IterationTimeline[]): SelfAuditFinding[] {
  const findings: SelfAuditFinding[] = [];
  const ids = new Map<string, number>();
  const timelineKeys = new Set(timelines.map((item) => getTimelineKey(item)));

  requirements.forEach((item) => {
    ids.set(item.id, (ids.get(item.id) ?? 0) + 1);

    if (!normalizeText(item.id)) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "blocker",
          checkCode: "REQ_ID_EMPTY",
          title: "需求编号为空",
          message: "存在需求记录未解析出编号。",
          suggestion: "检查需求编号字段映射。",
          sourceType: "requirement"
        })
      );
    }

    if (normalizeText(item.raw["需求场景"]) && !normalizeText(item.versionLine)) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "high",
          checkCode: "REQ_VERSION_LINE_MISSING",
          title: "需求版本线未识别",
          message: `需求 ${item.id} 有需求场景，但版本线为空。`,
          itemId: item.id,
          suggestion: "检查需求场景字段映射与版本解析。",
          sourceType: "requirement"
        })
      );
    }

    if (item.progressPercent < 20 && /上线/.test(normalizeText(item.stage))) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "blocker",
          checkCode: "REQ_STAGE_PROGRESS_CONFLICT",
          title: "需求阶段与进度强冲突",
          message: `需求 ${item.id} 进度仅 ${item.progressPercent}% ，但阶段为 ${item.stage}。`,
          itemId: item.id,
          expected: "早期阶段",
          actual: item.stage,
          suggestion: "检查阶段推断规则或进度字段解析。",
          sourceType: "requirement"
        })
      );
    }

    if (/需求澄清/.test(normalizeText(item.raw["研发进展"])) && /开发|转测|上线/.test(normalizeText(item.stage))) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "high",
          checkCode: "REQ_PROGRESS_STAGE_MISMATCH",
          title: "需求研发进展与阶段不一致",
          message: `需求 ${item.id} 的研发进展为需求澄清，但阶段为 ${item.stage}。`,
          itemId: item.id,
          expected: "需求澄清",
          actual: item.stage,
          suggestion: "检查研发进展字段映射和阶段推断。",
          sourceType: "requirement"
        })
      );
    }

    if (item.fullVersion && !timelineKeys.has(getTimelineKey(item))) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "medium",
          checkCode: "REQ_TIMELINE_MISSING",
          title: "需求未能匹配时间轴",
          message: `需求 ${item.id} 的小迭代 ${item.fullVersion} 未在时间轴中找到。`,
          itemId: item.id,
          versionKey: item.versionKey,
          suggestion: "补齐时间轴节点或检查迭代计划解析。",
          sourceType: "requirement"
        })
      );
    }
  });

  ids.forEach((count, id) => {
    if (id && count > 1) {
      findings.push(
        createFinding({
          category: "requirement",
          level: "blocker",
          checkCode: "REQ_ID_DUPLICATED",
          title: "需求编号重复",
          message: `需求编号 ${id} 出现 ${count} 次。`,
          itemId: id,
          expected: "unique",
          actual: String(count),
          suggestion: "清理重复需求。",
          sourceType: "requirement"
        })
      );
    }
  });

  return findings;
}

function validateIssues(issues: Issue[], context: { versionLine: string; releaseVersion: string }): SelfAuditFinding[] {
  const findings: SelfAuditFinding[] = [];
  const ids = new Map<string, number>();
  const severityScoreMap: Record<string, number> = { 提示: 0.1, 一般: 1, 严重: 3, 致命: 5 };

  issues.forEach((item) => {
    ids.set(item.id, (ids.get(item.id) ?? 0) + 1);

    if (!normalizeText(item.id)) {
      findings.push(
        createFinding({
          category: "issue",
          level: "blocker",
          checkCode: "ISSUE_ID_EMPTY",
          title: "问题编号为空",
          message: "存在问题单未解析出编号。",
          suggestion: "检查问题编号字段映射。",
          sourceType: "issue"
        })
      );
    }

    if (item.severity in severityScoreMap && Number(item.severityScore) !== severityScoreMap[item.severity]) {
      findings.push(
        createFinding({
          category: "issue",
          level: item.severity === "致命" ? "blocker" : "high",
          checkCode: "ISSUE_DI_MISMATCH",
          title: "问题单 DI 计算异常",
          message: `问题单 ${item.id} 的严重程度为 ${item.severity}，DI 应为 ${severityScoreMap[item.severity]}，当前为 ${item.severityScore}。`,
          itemId: item.id,
          expected: String(severityScoreMap[item.severity]),
          actual: String(item.severityScore),
          suggestion: "检查严重程度和 DI 规则。",
          sourceType: "issue"
        })
      );
    }

    const expectedRelation = computeIssueVersionRelation(item, {
      versionLine: context.versionLine || undefined,
      releaseVersion: context.releaseVersion || undefined
    });

    if (item.versionRelation && item.versionRelation !== expectedRelation) {
      findings.push(
        createFinding({
          category: "issue",
          level: "high",
          checkCode: "ISSUE_VERSION_RELATION_MISMATCH",
          title: "问题版本关联判断异常",
          message: `问题单 ${item.id} 当前标记为 ${item.versionRelation}，规则判断更接近 ${expectedRelation}。`,
          itemId: item.id,
          expected: expectedRelation,
          actual: item.versionRelation,
          suggestion: "检查问题版本归属与当前页面上下文。",
          sourceType: "issue"
        })
      );
    }

    if (normalizeText(item.deliveryScene) && !normalizeText(item.versionLine)) {
      findings.push(
        createFinding({
          category: "issue",
          level: "high",
          checkCode: "ISSUE_VERSION_LINE_MISSING",
          title: "问题版本线未识别",
          message: `问题单 ${item.id} 有交付场景 ${item.deliveryScene}，但版本线为空。`,
          itemId: item.id,
          suggestion: "检查交付场景映射。",
          sourceType: "issue"
        })
      );
    }

    if (!normalizeText(item.owner) && !normalizeText(item.devOwner) && !normalizeText(item.tester)) {
      findings.push(
        createFinding({
          category: "issue",
          level: "medium",
          checkCode: "ISSUE_OWNER_MISSING",
          title: "问题责任人缺失",
          message: `问题单 ${item.id} 缺少责任人和研发/测试责任人。`,
          itemId: item.id,
          suggestion: "补齐责任人信息。",
          sourceType: "issue"
        })
      );
    }
  });

  ids.forEach((count, id) => {
    if (id && count > 1) {
      findings.push(
        createFinding({
          category: "issue",
          level: "blocker",
          checkCode: "ISSUE_ID_DUPLICATED",
          title: "问题编号重复",
          message: `问题编号 ${id} 出现 ${count} 次。`,
          itemId: id,
          expected: "unique",
          actual: String(count),
          suggestion: "清理重复问题单。",
          sourceType: "issue"
        })
      );
    }
  });

  return findings;
}

function validateTimeline(timelines: IterationTimeline[], requirements: Requirement[], issues: Issue[]): SelfAuditFinding[] {
  const findings: SelfAuditFinding[] = [];
  const nodeCounts = new Map<string, number>();
  const timelineIterationKeys = new Set(timelines.filter((item) => item.fullVersion).map((item) => item.fullVersion));

  timelines.forEach((item) => {
    const dupKey = `${item.versionLine}/${item.releaseVersion}/${item.fullVersion}/${item.dateLabel}`;
    nodeCounts.set(dupKey, (nodeCounts.get(dupKey) ?? 0) + 1);

    if (!normalizeText(item.versionLine)) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "blocker",
          checkCode: "TIMELINE_VERSION_LINE_EMPTY",
          title: "时间轴版本线为空",
          message: `时间轴节点 ${item.id} 缺少版本线。`,
          itemId: item.id,
          suggestion: "检查版本线字段映射。",
          sourceType: "timeline"
        })
      );
    }

    if (!normalizeText(item.releaseVersion)) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "blocker",
          checkCode: "TIMELINE_RELEASE_EMPTY",
          title: "时间轴版本号为空",
          message: `时间轴节点 ${item.id} 缺少版本号。`,
          itemId: item.id,
          suggestion: "检查版本号字段映射。",
          sourceType: "timeline"
        })
      );
    }

    if (!normalizeText(item.fullVersion) && !normalizeText(item.label)) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "medium",
          checkCode: "TIMELINE_NODE_INFO_EMPTY",
          title: "时间轴节点信息不足",
          message: `时间轴节点 ${item.id} 的小迭代和说明同时为空。`,
          itemId: item.id,
          suggestion: "补充小迭代或说明。",
          sourceType: "timeline"
        })
      );
    }
  });

  nodeCounts.forEach((count, key) => {
    if (count > 1) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "medium",
          checkCode: "TIMELINE_NODE_DUPLICATED",
          title: "时间轴节点重复",
          message: `时间轴节点 ${key} 出现 ${count} 次。`,
          itemId: key,
          expected: "unique",
          actual: String(count),
          suggestion: "检查时间轴重复节点。",
          sourceType: "timeline"
        })
      );
    }
  });

  [...new Set(requirements.map((item) => item.fullVersion).filter(Boolean))].forEach((iteration) => {
    if (!timelineIterationKeys.has(iteration)) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "medium",
          checkCode: "TIMELINE_REQ_COVERAGE_MISSING",
          title: "时间轴缺少需求使用的小迭代",
          message: `需求使用了小迭代 ${iteration}，但时间轴未覆盖。`,
          itemId: iteration,
          suggestion: "补齐时间轴节点。",
          sourceType: "timeline"
        })
      );
    }
  });

  [...new Set(issues.map((item) => item.foundIteration).filter(Boolean))].forEach((iteration) => {
    if (!timelineIterationKeys.has(iteration)) {
      findings.push(
        createFinding({
          category: "timeline",
          level: "medium",
          checkCode: "TIMELINE_ISSUE_COVERAGE_MISSING",
          title: "时间轴缺少问题单使用的小迭代",
          message: `问题单使用了小迭代 ${iteration}，但时间轴未覆盖。`,
          itemId: iteration,
          suggestion: "补齐时间轴节点。",
          sourceType: "timeline"
        })
      );
    }
  });

  return findings;
}

function validatePageViewModel(input: SelfAuditInput): SelfAuditFinding[] {
  const findings: SelfAuditFinding[] = [];
  const {
    requirements,
    issues,
    timelines,
    derived,
    highlightedRequirementRisks,
    highlightedIssueRisks,
    highlightedOwners
  } = input;

  if (derived.topStats.requirementCount !== derived.scopedRequirements.length || derived.scopedRequirements.length !== requirements.length) {
    findings.push(
      createFinding({
        category: "page",
        level: "high",
        checkCode: "PAGE_REQUIREMENT_COUNT_MISMATCH",
        title: "页面需求数量与底层数据不一致",
        message: `页面需求统计为 ${derived.topStats.requirementCount}，渲染需求为 ${derived.scopedRequirements.length}，底层需求为 ${requirements.length}。`,
        expected: String(requirements.length),
        actual: `${derived.topStats.requirementCount}/${derived.scopedRequirements.length}`,
        suggestion: "检查需求列表 ViewModel 与筛选条件。",
        sourceType: "page"
      })
    );
  }

  if (derived.topStats.issueCount !== derived.scopedIssues.length || derived.scopedIssues.length !== issues.length) {
    findings.push(
      createFinding({
        category: "page",
        level: "high",
        checkCode: "PAGE_ISSUE_COUNT_MISMATCH",
        title: "页面问题单数量与底层数据不一致",
        message: `页面问题单统计为 ${derived.topStats.issueCount}，渲染问题单为 ${derived.scopedIssues.length}，底层问题单为 ${issues.length}。`,
        expected: String(issues.length),
        actual: `${derived.topStats.issueCount}/${derived.scopedIssues.length}`,
        suggestion: "检查问题单 ViewModel 与筛选条件。",
        sourceType: "page"
      })
    );
  }

  const requirementRiskIds = new Set(derived.requirementRisks.map((item) => item.itemId));
  highlightedRequirementRisks.forEach((item) => {
    if (!requirementRiskIds.has(item.id)) {
      findings.push(
        createFinding({
          category: "page",
          level: "high",
          checkCode: "PAGE_HIGHLIGHTED_REQUIREMENT_UNSUPPORTED",
          title: "高风险需求高亮未命中规则",
          message: `页面高亮需求 ${item.id} 不在规则风险集合中。`,
          itemId: item.id,
          suggestion: "检查高风险需求排序和来源。",
          sourceType: "page"
        })
      );
    }
  });

  const issueRiskIds = new Set(derived.issueRisks.map((item) => item.itemId));
  highlightedIssueRisks.forEach((item) => {
    if (!issueRiskIds.has(item.id)) {
      findings.push(
        createFinding({
          category: "page",
          level: "high",
          checkCode: "PAGE_HIGHLIGHTED_ISSUE_UNSUPPORTED",
          title: "高风险问题单高亮未命中规则",
          message: `页面高亮问题单 ${item.id} 不在规则风险集合中。`,
          itemId: item.id,
          suggestion: "检查高风险问题单排序和来源。",
          sourceType: "page"
        })
      );
    }
  });

  const validOwners = new Set(
    [
      ...requirements.flatMap((item) => [item.owner, item.tester, item.riskOwner]),
      ...issues.flatMap((item) => [item.owner, item.currentOwner, item.devOwner, item.tester])
    ].filter(Boolean)
  );
  highlightedOwners.forEach((item) => {
    if (!validOwners.has(item.name)) {
      findings.push(
        createFinding({
          category: "page",
          level: "high",
          checkCode: "PAGE_OWNER_NOT_FOUND",
          title: "页面责任人不在真实数据中",
          message: `页面高亮责任人 ${item.name} 未在需求或问题单责任人中找到。`,
          itemId: item.name,
          suggestion: "检查提醒对象聚合逻辑。",
          sourceType: "page"
        })
      );
    }
  });

  const totalDI = Number(issues.reduce((sum, item) => sum + item.severityScore, 0).toFixed(1));
  const openDI = Number(issues.filter((item) => item.status !== "关闭").reduce((sum, item) => sum + item.severityScore, 0).toFixed(1));
  if (derived.topStats.totalDI !== totalDI) {
    findings.push(
      createFinding({
        category: "page",
        level: "high",
        checkCode: "PAGE_TOTAL_DI_MISMATCH",
        title: "页面总 DI 与规则计算不一致",
        message: `页面总 DI 为 ${derived.topStats.totalDI}，规则计算为 ${totalDI}。`,
        expected: String(totalDI),
        actual: String(derived.topStats.totalDI),
        suggestion: "检查统计卡与过滤范围。",
        sourceType: "page"
      })
    );
  }
  if (derived.topStats.openDI !== openDI) {
    findings.push(
      createFinding({
        category: "page",
        level: "high",
        checkCode: "PAGE_OPEN_DI_MISMATCH",
        title: "页面未关闭 DI 与规则计算不一致",
        message: `页面未关闭 DI 为 ${derived.topStats.openDI}，规则计算为 ${openDI}。`,
        expected: String(openDI),
        actual: String(derived.topStats.openDI),
        suggestion: "检查未关闭问题单 DI 统计。",
        sourceType: "page"
      })
    );
  }
  if (timelines.length !== derived.scopedTimelines.length) {
    findings.push(
      createFinding({
        category: "page",
        level: "info",
        checkCode: "PAGE_TIMELINE_SCOPE_CHANGED",
        title: "页面时间轴使用了筛选后的数据",
        message: `当前渲染时间轴节点数为 ${derived.scopedTimelines.length}，底层时间轴总数为 ${timelines.length}。`,
        expected: String(timelines.length),
        actual: String(derived.scopedTimelines.length),
        suggestion: "如果当前启用了筛选可忽略，否则检查时间轴过滤条件。",
        sourceType: "page"
      })
    );
  }

  return findings;
}

function validateAIResults(input: SelfAuditInput): SelfAuditFinding[] {
  const findings: SelfAuditFinding[] = [];
  const {
    requirements,
    issues,
    recognitionResults,
    fieldMappings,
    transferResults,
    releaseResults,
    followups,
    derived
  } = input;
  const requirementIds = new Set(requirements.map((item) => item.id));
  const issueIds = new Set(issues.map((item) => item.id));
  const ownerNames = new Set(
    [
      ...requirements.flatMap((item) => [item.owner, item.tester, item.riskOwner]),
      ...issues.flatMap((item) => [item.owner, item.currentOwner, item.devOwner, item.tester])
    ].filter(Boolean)
  );

  recognitionResults.forEach((item) => {
    const headerSet = new Set(item.headers);
    if (item.detectedType !== item.ruleType && item.confidence < 0.8) {
      findings.push(
        createFinding({
          category: "ai",
          level: "medium",
          checkCode: "AI_RECOGNITION_CONFLICT",
          title: "AI 表格识别与规则结果冲突",
          message: `文件 ${item.fileName} 的规则识别为 ${item.ruleType}，最终识别为 ${item.finalType}，置信度 ${item.confidence.toFixed(2)}。`,
          fileName: item.fileName,
          expected: item.ruleType,
          actual: item.finalType,
          suggestion: "建议人工确认文件类型。",
          sourceType: "recognition"
        })
      );
    }
    if (item.finalType === "issue" && !["问题编号", "问题标题"].some((header) => headerSet.has(header))) {
      findings.push(
        createFinding({
          category: "ai",
          level: "high",
          checkCode: "AI_RECOGNITION_LOW_SIGNAL",
          title: "AI 识别为问题单，但关键列信号弱",
          message: `文件 ${item.fileName} 缺少问题编号/问题标题等关键列。`,
          fileName: item.fileName,
          suggestion: "人工确认该文件类型。",
          sourceType: "recognition"
        })
      );
    }
  });

  const allowedTargets = new Set([
    "id", "title", "type", "status", "stage", "owner", "tester", "creator",
    "versionLine", "releaseVersion", "cycleVersion", "patchVersion", "fullVersion",
    "progress", "progressPercent", "createTime", "startDate", "endDate", "onlinePlanTime",
    "issueCount", "risk", "riskOwner", "severity", "severityScore", "currentOwner",
    "devOwner", "team", "requirementId", "createdAt", "dueDate", "closeTime",
    "rootCause", "solutionPlan", "weekRange", "dateLabel", "label", "branch", "toolkit",
    "startTime", "endTime"
  ]);
  fieldMappings.forEach((mapping) => {
    const targetMap = new Map<string, string[]>();
    Object.entries(mapping.mapping).forEach(([source, target]) => {
      if (!allowedTargets.has(target)) {
        findings.push(
          createFinding({
            category: "ai",
            level: "medium",
            checkCode: "AI_MAPPING_UNKNOWN_TARGET",
            title: "AI 字段映射目标不在允许集合中",
            message: `文件 ${mapping.fileName} 将字段 ${source} 映射到未知目标 ${target}。`,
            fileName: mapping.fileName,
            expected: "known field",
            actual: target,
            suggestion: "收敛 AI 映射输出范围。",
            sourceType: "mapping"
          })
        );
      }
      targetMap.set(target, [...(targetMap.get(target) ?? []), source]);
    });
    ["id", "title", "owner"].forEach((target) => {
      if ((targetMap.get(target) ?? []).length > 1) {
        findings.push(
          createFinding({
            category: "ai",
            level: "medium",
            checkCode: "AI_MAPPING_DUPLICATED_KEY_FIELD",
            title: "AI 将多个原字段映射到同一关键字段",
            message: `文件 ${mapping.fileName} 有多个字段映射到 ${target}: ${(targetMap.get(target) ?? []).join(", ")}。`,
            fileName: mapping.fileName,
            suggestion: "人工确认字段映射。",
            sourceType: "mapping"
          })
        );
      }
    });
  });

  transferResults.forEach((item) => {
    item.blockers.forEach((blocker) => {
      if (!requirementIds.has(blocker) && !issueIds.has(blocker)) {
        findings.push(
          createFinding({
            category: "ai",
            level: "high",
            checkCode: "AI_TRANSFER_BLOCKER_NOT_FOUND",
            title: "AI 转测 blocker 不存在",
            message: `转测风险 ${item.iterationKey} 输出的 blocker ${blocker} 不存在。`,
            itemId: blocker,
            versionKey: item.iterationKey,
            suggestion: "检查 AI 输出质量。",
            sourceType: "transfer-risk"
          })
        );
      }
    });
    item.notifyOwners.forEach((owner) => {
      if (!ownerNames.has(owner.name)) {
        findings.push(
          createFinding({
            category: "ai",
            level: "high",
            checkCode: "AI_TRANSFER_NOTIFY_OWNER_NOT_FOUND",
            title: "AI 转测提醒对象不存在",
            message: `转测风险 ${item.iterationKey} 推荐提醒 ${owner.name}，但真实数据中不存在。`,
            itemId: owner.itemId,
            versionKey: item.iterationKey,
            suggestion: "检查提醒对象来源。",
            sourceType: "transfer-risk"
          })
        );
      }
    });
    const ruleRiskCount = derived.requirementRisks.filter((risk) => requirements.find((req) => req.id === risk.itemId)?.fullVersion === item.iterationKey).length;
    if (ruleRiskCount >= 2 && item.riskLevel === "无") {
      findings.push(
        createFinding({
          category: "ai",
          level: "high",
          checkCode: "AI_TRANSFER_RISK_CONFLICT",
          title: "AI 转测风险结论与规则强冲突",
          message: `小迭代 ${item.iterationKey} 规则命中 ${ruleRiskCount} 条风险，但 AI 结论为无风险。`,
          itemId: item.iterationKey,
          expected: "high or medium",
          actual: item.riskLevel,
          suggestion: "标记结果待确认。",
          sourceType: "transfer-risk"
        })
      );
    }
  });

  releaseResults.forEach((item) => {
    item.blockingIssueIds.forEach((blocker) => {
      if (!issueIds.has(blocker)) {
        findings.push(
          createFinding({
            category: "ai",
            level: "high",
            checkCode: "AI_RELEASE_BLOCKER_NOT_FOUND",
            title: "AI 上线 blocker 不存在",
            message: `上线风险 ${item.versionLine}/${item.releaseVersion} 输出的 blocker ${blocker} 不存在。`,
            itemId: blocker,
            versionKey: `${item.versionLine}/${item.releaseVersion}`,
            suggestion: "检查 AI 输出质量。",
            sourceType: "release-risk"
          })
        );
      }
    });
    const criticalOpenCount = issues.filter(
      (issue) =>
        issue.versionLine === item.versionLine &&
        issue.releaseVersion === item.releaseVersion &&
        issue.severity === "致命" &&
        issue.status !== "关闭"
    ).length;
    if (criticalOpenCount > 0 && (item.riskLevel === "低" || item.riskLevel === "无")) {
      findings.push(
        createFinding({
          category: "ai",
          level: "blocker",
          checkCode: "AI_RELEASE_CRITICAL_CONFLICT",
          title: "AI 上线风险结论与致命未关闭问题单冲突",
          message: `${item.versionLine}/${item.releaseVersion} 仍有 ${criticalOpenCount} 个致命未关闭问题单，但 AI 结论为 ${item.riskLevel}。`,
          itemId: `${item.versionLine}/${item.releaseVersion}`,
          expected: "高风险",
          actual: item.riskLevel,
          suggestion: "该版本风险结果应标记待确认。",
          sourceType: "release-risk"
        })
      );
    }
    if (item.openDI >= 8 && (item.riskLevel === "低" || item.riskLevel === "无")) {
      findings.push(
        createFinding({
          category: "ai",
          level: "high",
          checkCode: "AI_RELEASE_DI_CONFLICT",
          title: "AI 上线风险结论与未关闭 DI 冲突",
          message: `${item.versionLine}/${item.releaseVersion} 未关闭 DI 为 ${item.openDI}，但 AI 结论为 ${item.riskLevel}。`,
          itemId: `${item.versionLine}/${item.releaseVersion}`,
          expected: "中/高风险",
          actual: item.riskLevel,
          suggestion: "该版本风险结果应标记待确认。",
          sourceType: "release-risk"
        })
      );
    }
  });

  followups.forEach((item) => {
    if (!ownerNames.has(item.name)) {
      findings.push(
        createFinding({
          category: "ai",
          level: "high",
          checkCode: "AI_FOLLOWUP_OWNER_NOT_FOUND",
          title: "AI 提醒对象不存在",
          message: `提醒对象 ${item.name} 未在真实责任人集合中找到。`,
          itemId: item.itemId,
          suggestion: "检查 followup 输出。",
          sourceType: "followup"
        })
      );
    }
    if (!normalizeText(item.reason)) {
      findings.push(
        createFinding({
          category: "ai",
          level: "medium",
          checkCode: "AI_FOLLOWUP_REASON_EMPTY",
          title: "AI 提醒原因为空",
          message: `提醒对象 ${item.name}/${item.itemId} 缺少 reason。`,
          itemId: item.itemId,
          suggestion: "要求 AI 返回非空 reason。",
          sourceType: "followup"
        })
      );
    }
  });

  return findings;
}

export function buildSelfAuditReport(findings: SelfAuditFinding[] = []): SelfAuditReport {
  const safeFindings = Array.isArray(findings) ? findings : [];
  const sorted = [...safeFindings].sort((a, b) => levelWeight[b.level] - levelWeight[a.level] || a.title.localeCompare(b.title, "zh-CN"));
  return {
    summary: {
      totalChecks: sorted.length,
      blockerCount: sorted.filter((item) => item.level === "blocker").length,
      highCount: sorted.filter((item) => item.level === "high").length,
      mediumCount: sorted.filter((item) => item.level === "medium").length,
      lowCount: sorted.filter((item) => item.level === "low").length,
      infoCount: sorted.filter((item) => item.level === "info").length
    },
    sections: Object.fromEntries(allCategories.map((category) => [category, sorted.filter((item) => item.category === category)])) as SelfAuditReport["sections"],
    passed: !sorted.some((item) => item.level === "blocker" || item.level === "high"),
    topFindings: sorted.slice(0, 8)
  };
}

export function getAuditSeverityColor(level: AuditLevel) {
  return {
    blocker: "border-rose-300 bg-rose-50 text-rose-800",
    high: "border-red-200 bg-red-50 text-red-800",
    medium: "border-amber-200 bg-amber-50 text-amber-800",
    low: "border-yellow-200 bg-yellow-50 text-yellow-800",
    info: "border-cyan-200 bg-cyan-50 text-cyan-800"
  }[level];
}

export function groupFindingsByCategory(findings: SelfAuditFinding[] = []) {
  const safeFindings = Array.isArray(findings) ? findings : [];
  return Object.fromEntries(allCategories.map((category) => [category, safeFindings.filter((item) => item.category === category)])) as Record<AuditCategory, SelfAuditFinding[]>;
}

export function runSelfAudit(input: SelfAuditInput) {
  const findings = [
    ...validateRequirements(input.requirements, input.timelines),
    ...validateIssues(input.issues, {
      versionLine: input.currentContext.versionLine,
      releaseVersion: input.currentContext.releaseVersion
    }),
    ...validateTimeline(input.timelines, input.requirements, input.issues),
    ...validatePageViewModel(input),
    ...validateAIResults(input)
  ];

  return {
    findings,
    report: buildSelfAuditReport(findings)
  };
}

export function extractUntrustedItemIds(findings: SelfAuditFinding[] = []) {
  const safeFindings = Array.isArray(findings) ? findings : [];
  const requirementIds = new Set<string>();
  const issueIds = new Set<string>();
  const ownerNames = new Set<string>();
  const fileNames = new Set<string>();
  const releaseKeys = new Set<string>();
  const iterationKeys = new Set<string>();

  safeFindings.forEach((item) => {
    if (!["blocker", "high"].includes(item.level)) return;
    if (item.sourceType === "requirement" && item.itemId) requirementIds.add(item.itemId);
    if (item.sourceType === "issue" && item.itemId) issueIds.add(item.itemId);
    if (["followup", "page"].includes(item.sourceType) && item.itemId) ownerNames.add(item.itemId);
    if (item.sourceType === "recognition" && item.fileName) fileNames.add(item.fileName);
    if (item.sourceType === "release-risk" && item.itemId) releaseKeys.add(item.itemId);
    if (item.sourceType === "transfer-risk" && item.versionKey) iterationKeys.add(item.versionKey);
  });

  return { requirementIds, issueIds, ownerNames, fileNames, releaseKeys, iterationKeys };
}
