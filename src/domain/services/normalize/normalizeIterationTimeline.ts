import type { IterationTimeline } from "../../models/iterationTimeline";
import { pickFirst, safeClone } from "../../../utils/helpers";
import { toDateStr } from "../../../utils/date";
import { parseVersionInfo } from "./parseVersionInfo";

export function normalizeIterationTimeline(input: Record<string, unknown>, index = 0): IterationTimeline {
  const versionInfo = parseVersionInfo(
    [
      pickFirst(input, ["完整版本", "fullVersion"]),
      pickFirst(input, ["版本号", "releaseVersion"]),
      pickFirst(input, ["小迭代", "cycleVersion"])
        ? `${String(pickFirst(input, ["版本号", "releaseVersion"]) || "").trim()}-${String(pickFirst(input, ["小迭代", "cycleVersion"]) || "").trim()}${pickFirst(input, ["补丁版本", "patchVersion"]) ? `.${String(pickFirst(input, ["补丁版本", "patchVersion"]))}` : ""}`
        : ""
    ],
    pickFirst(input, ["大版本线", "versionLine", "交付场景"])
  );

  return {
    ...versionInfo,
    id: `${versionInfo.versionKey || `timeline-${index + 1}`}`,
    startDate: toDateStr(pickFirst(input, ["开始时间", "startDate"])),
    endDate: toDateStr(pickFirst(input, ["结束时间", "endDate"])),
    owner: String(pickFirst(input, ["责任人", "owner"]) || ""),
    raw: safeClone(input)
  };
}
