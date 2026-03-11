import type { Issue } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import type { VersionInfo } from "../../models/version";
import { getDisplayVersion } from "../normalize/parseVersionInfo";

export type VersionGroupLevel = "versionLine" | "majorVersion" | "fullVersion";

function getMajorGroupKey(info: Partial<VersionInfo>) {
  return info.releaseKey || info.majorVersionKey || info.releaseVersion || info.versionLine || info.versionScene || "未分配版本";
}

export function getVersionGroupKey(info: Partial<VersionInfo>, level: VersionGroupLevel): string {
  if (level === "versionLine") return info.versionLine || info.versionScene || "未分配版本";
  if (level === "majorVersion") return getMajorGroupKey(info);
  return info.versionKey || getDisplayVersion(info);
}

export function groupByVersion<T extends Requirement | Issue>(items: T[], level: VersionGroupLevel): Record<string, T[]> {
  return items.reduce<Record<string, T[]>>((acc, item) => {
    const key = getVersionGroupKey(item, level);
    acc[key] = acc[key] || [];
    acc[key].push(item);
    return acc;
  }, {});
}

export function groupRequirementsByVersionLine(requirements: Requirement[]) {
  return groupByVersion(requirements, "versionLine");
}

export function groupRequirementsByReleaseVersion(requirements: Requirement[]) {
  return groupByVersion(requirements, "majorVersion");
}

export function groupIssuesByReleaseVersion(issues: Issue[]) {
  return groupByVersion(issues, "majorVersion");
}
