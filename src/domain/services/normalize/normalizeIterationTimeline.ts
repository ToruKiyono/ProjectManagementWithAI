import type { IterationTimeline } from "../../models/iterationTimeline";
import { pickFirst, safeClone } from "../../../utils/helpers";
import { toDateStr } from "../../../utils/date";
import { parseVersionInfo } from "./parseVersionInfo";

function inferMilestoneType(label: string) {
  if (label.includes("评审")) return "review";
  if (label.includes("转测")) return "transfer";
  if (label.includes("发布")) return "release";
  return "iteration";
}

function inferTransferProgress(value: unknown, label: string) {
  const direct = Number(value ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const matched = label.match(/(\d+)%/);
  return matched ? Number(matched[1]) : 0;
}

export function normalizeIterationTimeline(input: Record<string, unknown>, index = 0): IterationTimeline {
  const releaseVersion = String(pickFirst(input, ["版本号", "releaseVersion"]) || "");
  const cycleVersion = String(pickFirst(input, ["小迭代", "cycleVersion"]) || "");
  const patchVersion = String(pickFirst(input, ["补丁版本", "patchVersion"]) || "");
  const versionInfo = parseVersionInfo(
    [
      pickFirst(input, ["完整版本", "fullVersion"]),
      releaseVersion,
      cycleVersion ? `${releaseVersion}-${cycleVersion}${patchVersion ? `.${patchVersion}` : ""}` : ""
    ],
    pickFirst(input, ["版本线", "versionLine", "交付场景"])
  );
  const label = String(pickFirst(input, ["说明", "label"]) || "");
  const dateLabel = toDateStr(pickFirst(input, ["日期", "dateLabel"]));

  return {
    ...versionInfo,
    id: `${versionInfo.versionKey || "timeline"}:${dateLabel || index + 1}:${versionInfo.cycleVersion || label || "node"}`,
    startDate: toDateStr(pickFirst(input, ["开始时间", "startDate"])),
    endDate: toDateStr(pickFirst(input, ["结束时间", "endDate"])),
    owner: String(pickFirst(input, ["责任人", "owner"]) || ""),
    weekRange: String(pickFirst(input, ["周时间", "weekRange"]) || ""),
    dateLabel,
    label,
    branch: String(pickFirst(input, ["分支", "branch"]) || ""),
    toolkit: String(pickFirst(input, ["toolkit"]) || ""),
    milestoneType: String(pickFirst(input, ["milestoneType"]) || inferMilestoneType(label)),
    transferProgress: inferTransferProgress(pickFirst(input, ["transferProgress"]), label),
    raw: safeClone(input)
  };
}
