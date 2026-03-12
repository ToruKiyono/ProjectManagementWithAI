import type { Requirement } from "../../models/requirement";
import { requirementStages } from "../../models/requirement";
import type { IssueRisk, MajorVersionIssueSummary, RequirementRisk } from "./management";
import type { VersionTimelineConfig, VersionTimelineMilestoneConfig, VersionTimelineMilestoneType } from "../../../seed/versionTimelineSeed";
import { todayLocalStr } from "../../../utils/date";

export type VersionTimelineRisk = {
  type: "timeline";
  level: "高" | "中" | "低";
  versionLine: string;
  releaseVersion: string;
  cycleVersion: string;
  owner: string;
  reason: string;
};

export type VersionTimelineMilestoneView = VersionTimelineMilestoneConfig & {
  fullVersion: string;
  isoDate: string;
  transferProgressActual: number | null;
  transferProgressPlanned: number | null;
  isFullTransfer: boolean;
  isReleaseReview: boolean;
  requirementCount: number;
  riskRequirementCount: number;
  stageCounts: Record<string, number>;
  openIssueCount: number;
  blocked: boolean;
};

export type VersionTimelineRowView = {
  versionLine: string;
  releaseVersion: string;
  title: string;
  extraInfo: string;
  weeks: string[];
  milestones: VersionTimelineMilestoneView[];
  status: "正常" | "关注" | "滞后";
  currentCycleVersion: string;
  currentTransferLabel: string;
  isCurrentWeekGapRisk: boolean;
};

export type VersionTimelineBoardView = {
  weeks: string[];
  currentWeekRange: string;
  rows: VersionTimelineRowView[];
  risks: VersionTimelineRisk[];
};

function stageIndex(stage: string) {
  return requirementStages.indexOf(stage as (typeof requirementStages)[number]);
}

function parseLabelDate(dateLabel: string) {
  const [monthText, dayText] = dateLabel.split(".");
  const month = Number(monthText);
  const day = Number(dayText);
  return { month, day };
}

function toIsoDate(dateLabel: string, fallbackYear = 2026) {
  const { month, day } = parseLabelDate(dateLabel);
  return `${fallbackYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parseWeekRange(weekRange: string, fallbackYear = 2026) {
  const [startText, endText] = weekRange.split("-");
  const [startMonth, startDay] = startText.split(".").map(Number);
  const [endMonth, endDay] = endText.split(".").map(Number);
  return {
    startDate: `${fallbackYear}-${String(startMonth).padStart(2, "0")}-${String(startDay).padStart(2, "0")}`,
    endDate: `${fallbackYear}-${String(endMonth).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`
  };
}

function uniq<T>(items: T[]) {
  return [...new Set(items)];
}

function buildFullVersion(releaseVersion: string, cycleVersion: string) {
  return cycleVersion ? `${releaseVersion}-${cycleVersion}` : releaseVersion;
}

function calcTransferProgress(requirements: Requirement[]) {
  if (!requirements.length) return null;
  const transferStageIdx = stageIndex("需求转测");
  const transferred = requirements.filter((item) => stageIndex(item.stage) >= transferStageIdx).length;
  return Math.round((transferred / requirements.length) * 100);
}

function countRiskRequirements(requirements: Requirement[], requirementRisks: RequirementRisk[]) {
  const riskIds = new Set(requirementRisks.map((item) => item.itemId));
  return requirements.filter((item) => item.risk || riskIds.has(item.id)).length;
}

function getMilestoneOwner(requirements: Requirement[]) {
  return uniq(requirements.map((item) => item.riskOwner || item.owner).filter(Boolean))[0] ?? "";
}

function summarizeMilestoneStages(requirements: Requirement[]) {
  return Object.fromEntries(
    requirementStages.map((stage) => [stage, requirements.filter((item) => item.stage === stage).length])
  );
}

export function getCurrentWeekRange(weeks: string[], today = todayLocalStr()) {
  return weeks.find((week) => {
    const { startDate, endDate } = parseWeekRange(week);
    return today >= startDate && today <= endDate;
  }) ?? "";
}

export function buildVersionTimelineBoardView(args: {
  configs: VersionTimelineConfig[];
  requirements: Requirement[];
  requirementRisks: RequirementRisk[];
  issueRisks: IssueRisk[];
  majorSummaries: MajorVersionIssueSummary[];
}) {
  const { configs, requirements, requirementRisks, issueRisks, majorSummaries } = args;
  const weeks = uniq(configs.flatMap((item) => item.milestones.map((milestone) => milestone.weekRange)))
    .sort((a, b) => parseWeekRange(a).startDate.localeCompare(parseWeekRange(b).startDate, "zh-CN"));
  const today = todayLocalStr();
  const currentWeekRange = getCurrentWeekRange(weeks, today);
  const reviewLeadDate = `${today.slice(0, 4)}-${today.slice(5, 10)}`;
  void reviewLeadDate;

  const risks: VersionTimelineRisk[] = [];

  const rows: VersionTimelineRowView[] = configs.map((config) => {
    const versionRequirements = requirements.filter(
      (item) => item.versionLine === config.versionLine && item.releaseVersion === config.releaseVersion
    );
    const versionRequirementRisks = requirementRisks.filter(
      (item) =>
        versionRequirements.some((requirement) => requirement.id === item.itemId)
    );
    const versionIssueRisks = issueRisks.filter(
      (item) => item.versionLine === config.versionLine && item.releaseVersion === config.releaseVersion
    );
    const milestones = config.milestones
      .map((milestone) => {
        const fullVersion = buildFullVersion(config.releaseVersion, milestone.cycleVersion);
        const milestoneRequirements = milestone.cycleVersion
          ? versionRequirements.filter(
              (item) => item.releaseVersion === config.releaseVersion && item.cycleVersion === milestone.cycleVersion
            )
          : versionRequirements;
        const transferProgressActual = calcTransferProgress(milestoneRequirements);
        const isFullTransfer = (transferProgressActual ?? 0) >= 100;
        const riskRequirementCount = countRiskRequirements(milestoneRequirements, versionRequirementRisks);
        const openIssueCount = versionIssueRisks.filter((item) => item.status !== "关闭").length;
        const planned = milestone.transferProgress;
        const isoDate = toIsoDate(milestone.dateLabel);
        const blocked =
          (planned !== null && isoDate <= today && transferProgressActual !== null && transferProgressActual + 10 < planned) ||
          ((planned === 100 || milestone.label.includes("全量需求转测")) && isoDate <= today && !isFullTransfer) ||
          (milestone.milestoneType === "review" && isoDate <= today && (riskRequirementCount > 0 || openIssueCount > 0));

        if (planned !== null && isoDate <= today && transferProgressActual !== null && transferProgressActual + 10 < planned) {
          risks.push({
            type: "timeline",
            level: planned >= 80 ? "高" : "中",
            versionLine: config.versionLine,
            releaseVersion: config.releaseVersion,
            cycleVersion: milestone.cycleVersion,
            owner: getMilestoneOwner(milestoneRequirements),
            reason: `计划达到需求转测 ${planned}%，实际仅 ${transferProgressActual}%`
          });
        }

        if ((planned === 100 || milestone.label.includes("全量需求转测")) && isoDate <= today && !isFullTransfer) {
          risks.push({
            type: "timeline",
            level: "高",
            versionLine: config.versionLine,
            releaseVersion: config.releaseVersion,
            cycleVersion: milestone.cycleVersion,
            owner: getMilestoneOwner(milestoneRequirements),
            reason: "计划进入全量需求转测，但当前仍有大量需求停留在需求开发阶段"
          });
        }

        if (milestone.milestoneType === "review" && isoDate <= today && (riskRequirementCount > 0 || openIssueCount > 0)) {
          risks.push({
            type: "timeline",
            level: "高",
            versionLine: config.versionLine,
            releaseVersion: config.releaseVersion,
            cycleVersion: milestone.cycleVersion,
            owner: "",
            reason: "临近发布评审仍存在风险需求或未关闭问题单"
          });
        }

        return {
          ...milestone,
          fullVersion,
          isoDate,
          transferProgressActual,
          transferProgressPlanned: planned,
          isFullTransfer,
          isReleaseReview: milestone.milestoneType === "review",
          requirementCount: milestoneRequirements.length,
          riskRequirementCount,
          stageCounts: summarizeMilestoneStages(milestoneRequirements),
          openIssueCount,
          blocked
        };
      })
      .sort((a, b) => a.isoDate.localeCompare(b.isoDate, "zh-CN"));

    const consecutiveSlowIterations = milestones
      .filter((item) => item.milestoneType === "iteration" && item.blocked)
      .length >= 2;

    if (consecutiveSlowIterations) {
      risks.push({
        type: "timeline",
        level: "中",
        versionLine: config.versionLine,
        releaseVersion: config.releaseVersion,
        cycleVersion: "",
        owner: "",
        reason: "连续多个小迭代推进缓慢，版本节奏存在持续滞后"
      });
    }

    const currentWeekHasMilestone = milestones.some((item) => item.weekRange === currentWeekRange);
    const firstWeek = milestones[0]?.weekRange ?? "";
    const lastWeek = milestones[milestones.length - 1]?.weekRange ?? "";
    const isCurrentWeekGapRisk =
      Boolean(currentWeekRange) &&
      Boolean(firstWeek) &&
      Boolean(lastWeek) &&
      currentWeekRange >= firstWeek &&
      currentWeekRange <= lastWeek &&
      !currentWeekHasMilestone;

    if (isCurrentWeekGapRisk) {
      risks.push({
        type: "timeline",
        level: "中",
        versionLine: config.versionLine,
        releaseVersion: config.releaseVersion,
        cycleVersion: "",
        owner: "",
        reason: "当前周无节奏节点，存在推进空档风险"
      });
    }

    const pastCycleMilestones = milestones.filter((item) => item.isoDate <= today && item.cycleVersion);
    const currentCycleVersion =
      pastCycleMilestones[pastCycleMilestones.length - 1]?.cycleVersion ??
      milestones.find((item) => item.cycleVersion)?.cycleVersion ??
      "";
    const pastMilestones = milestones.filter((item) => item.isoDate <= today);
    const currentMilestone = pastMilestones[pastMilestones.length - 1] ?? milestones[0];
    const currentTransferLabel =
      currentMilestone?.transferProgressActual !== null && currentMilestone?.transferProgressActual !== undefined
        ? `需求转测 ${currentMilestone.transferProgressActual}%`
        : currentMilestone?.label ?? "-";
    const riskCount = risks.filter(
      (item) => item.versionLine === config.versionLine && item.releaseVersion === config.releaseVersion
    ).length;

    return {
      versionLine: config.versionLine,
      releaseVersion: config.releaseVersion,
      title: config.title,
      extraInfo: config.extraInfo,
      weeks,
      milestones,
      status: riskCount >= 2 || milestones.some((item) => item.blocked) ? "滞后" : riskCount === 1 ? "关注" : "正常",
      currentCycleVersion,
      currentTransferLabel,
      isCurrentWeekGapRisk
    };
  });

  return {
    weeks,
    currentWeekRange,
    rows,
    risks: risks.sort((a, b) => {
      const levelWeight = { 高: 0, 中: 1, 低: 2 };
      return levelWeight[a.level] - levelWeight[b.level];
    })
  } satisfies VersionTimelineBoardView;
}

export function getMilestoneTone(type: VersionTimelineMilestoneType, fullTransfer: boolean, blocked: boolean) {
  if (blocked) return "border-rose-200 bg-rose-50 text-rose-700";
  if (type === "review") return "border-violet-200 bg-violet-50 text-violet-700";
  if (fullTransfer) return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-cyan-200 bg-cyan-50 text-cyan-700";
}
