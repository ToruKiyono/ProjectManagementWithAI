import type { Requirement } from "../../models/requirement";
import { groupByVersion } from "./groupByVersion";

export function groupRequirementsByVersion(requirements: Requirement[]): Record<string, Requirement[]> {
  return groupByVersion(requirements, "fullVersion");
}
