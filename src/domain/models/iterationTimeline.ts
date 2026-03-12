import type { VersionInfo } from "./version";

export type IterationTimeline = VersionInfo & {
  id: string;
  startDate: string;
  endDate: string;
  owner: string;
  weekRange: string;
  dateLabel: string;
  label: string;
  branch: string;
  toolkit: string;
  milestoneType: string;
  transferProgress: number;
  raw: Record<string, unknown>;
};
