export const VERSION_UNASSIGNED = "未分配版本";

export const VERSION_LINES = ["HC", "HCS", "HCSO", "会战版本"] as const;

export type VersionLine = (typeof VERSION_LINES)[number] | "";

export type VersionInfo = {
  versionLine: string;
  releaseVersion: string;
  cycleVersion: string;
  patchVersion: string;
  fullVersion: string;
  releaseKey: string;
  cycleKey: string;
  versionKey: string;

  // Legacy aliases kept for compatibility with older modules.
  majorVersion: string;
  minorVersion: string;
  minorIteration: string;
  version: string;
  versionScene: string;
  majorVersionKey: string;
};

export type VersionFilterLevel = "ALL" | "SCENE" | "MAJOR" | "CYCLE" | "FULL";

export type VersionFilter = {
  level: VersionFilterLevel;
  key: string;
};

export type VersionOption = {
  value: string;
  label: string;
};
