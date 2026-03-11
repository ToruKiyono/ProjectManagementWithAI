import type { VersionInfo } from "./version";

export type IterationTimeline = VersionInfo & {
  id: string;
  startDate: string;
  endDate: string;
  owner: string;
  raw: Record<string, unknown>;
};
