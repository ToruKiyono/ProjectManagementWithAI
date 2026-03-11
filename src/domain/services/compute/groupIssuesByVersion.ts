import type { Issue } from "../../models/issue";
import type { Requirement } from "../../models/requirement";
import { getVersionInfoSnapshot, mergeVersionInfo } from "../normalize/parseVersionInfo";
import { groupByVersion } from "./groupByVersion";

export function buildRequirementVersionMap(requirements: Requirement[]) {
  return new Map(requirements.map((requirement) => [requirement.id, getVersionInfoSnapshot(requirement)]));
}

export function resolveIssueVersionInfo(issue: Issue, requirementMap: Map<string, ReturnType<typeof getVersionInfoSnapshot>>) {
  return mergeVersionInfo(getVersionInfoSnapshot(issue), requirementMap.get(issue.requirementId));
}

export function groupIssuesByVersion(issues: Issue[], requirements: Requirement[]): Record<string, Issue[]> {
  const requirementMap = buildRequirementVersionMap(requirements);
  return groupByVersion(issues.map((issue) => ({ ...issue, ...resolveIssueVersionInfo(issue, requirementMap) })), "fullVersion");
}
