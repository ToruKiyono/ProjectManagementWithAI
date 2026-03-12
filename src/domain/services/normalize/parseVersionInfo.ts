import { VERSION_UNASSIGNED, type VersionFilter, type VersionInfo, type VersionOption } from "../../models/version";

function cleanText(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/[【】（）()]/g, " ")
    .replace(/\s+/g, " ");
}

export function normalizeVersionLine(value: unknown): string {
  const raw = cleanText(value);
  const upper = raw.toUpperCase();
  if (!raw) return "";
  if (raw.includes("会战")) return "会战版本";
  if (upper.includes("HCSO")) return raw.includes("会战") ? "会战版本" : "HCSO";
  if (upper.includes("HCS")) return raw.includes("会战") ? "会战版本" : "HCS";
  if (upper.includes("HC")) return raw.includes("会战") ? "会战版本" : "HC";
  return "";
}

function normalizeSourceVersion(value: string): string {
  return value
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/SP(\d+)/g, ".$1")
    .replace(/RC(\d+)/g, ".$1");
}

function parseSingleVersion(value: unknown) {
  const source = normalizeSourceVersion(cleanText(value));
  if (!source) {
    return { releaseVersion: "", cycleVersion: "", patchVersion: "", fullVersion: "" };
  }

  const releaseMatch = source.match(/\d+(?:\.\d+){1,2}(?:-HCSO)?/);
  const releaseVersion = releaseMatch?.[0] ?? "";

  const cycleMatch = source.match(/(?:^|[-_])(B\d+|REVIEW)(?:[._-](\d+))?$/);
  const cycleVersion = cycleMatch?.[1] ?? "";
  const patchVersion = cycleMatch?.[2] ?? "";
  const fullVersion = cycleVersion
    ? `${releaseVersion}-${cycleVersion}${patchVersion ? `.${patchVersion}` : ""}`
    : releaseVersion;

  return { releaseVersion, cycleVersion, patchVersion, fullVersion };
}

export function parseVersionInfo(value: unknown[] | unknown, versionLineHint?: unknown): VersionInfo {
  const candidates = (Array.isArray(value) ? value : [value]).map(cleanText).filter(Boolean);
  const raw = candidates.find((item) => /\d+(?:\.\d+){1,2}(?:-HCSO)?(?:-(?:B\d+|REVIEW)(?:\.\d+)?)?/i.test(item)) ?? candidates[0] ?? "";
  const parsed = parseSingleVersion(raw);
  const versionLine = normalizeVersionLine(versionLineHint ?? candidates.join(" ") ?? raw);
  const fullVersion = parsed.fullVersion || parsed.releaseVersion;
  const releaseKey = versionLine && parsed.releaseVersion ? `${versionLine}/${parsed.releaseVersion}` : "";
  const cycleKey = versionLine && parsed.releaseVersion && parsed.cycleVersion ? `${versionLine}/${parsed.releaseVersion}-${parsed.cycleVersion}` : "";
  const versionKey = versionLine && (fullVersion || parsed.releaseVersion)
    ? `${versionLine}/${fullVersion || parsed.releaseVersion}`
    : versionLine || VERSION_UNASSIGNED;
  const version = fullVersion || parsed.releaseVersion || versionLine || VERSION_UNASSIGNED;

  return {
    versionLine,
    releaseVersion: parsed.releaseVersion,
    cycleVersion: parsed.cycleVersion,
    patchVersion: parsed.patchVersion,
    fullVersion,
    releaseKey,
    cycleKey,
    versionKey,
    majorVersion: parsed.releaseVersion,
    minorVersion: parsed.cycleVersion,
    minorIteration: parsed.cycleVersion,
    version,
    versionScene: versionLine,
    majorVersionKey: releaseKey || versionLine || VERSION_UNASSIGNED
  };
}

export const parseVersion = parseVersionInfo;

export function mergeVersionInfo(primary?: Partial<VersionInfo>, fallback?: Partial<VersionInfo>): VersionInfo {
  const versionLine = String(primary?.versionLine || primary?.versionScene || fallback?.versionLine || fallback?.versionScene || "");
  const releaseVersion = String(primary?.releaseVersion || primary?.majorVersion || fallback?.releaseVersion || fallback?.majorVersion || "");
  const cycleVersion = String(primary?.cycleVersion || primary?.minorVersion || primary?.minorIteration || fallback?.cycleVersion || fallback?.minorVersion || fallback?.minorIteration || "");
  const patchVersion = String(primary?.patchVersion || fallback?.patchVersion || "");
  const fullVersion = String(
    primary?.fullVersion ||
      fallback?.fullVersion ||
      (releaseVersion ? `${releaseVersion}${cycleVersion ? `-${cycleVersion}` : ""}${patchVersion ? `.${patchVersion}` : ""}` : "")
  );
  const releaseKey = String(primary?.releaseKey || fallback?.releaseKey || (versionLine && releaseVersion ? `${versionLine}/${releaseVersion}` : ""));
  const cycleKey = String(primary?.cycleKey || fallback?.cycleKey || (versionLine && releaseVersion && cycleVersion ? `${versionLine}/${releaseVersion}-${cycleVersion}` : ""));
  const versionKey = String(primary?.versionKey || fallback?.versionKey || (versionLine && (fullVersion || releaseVersion) ? `${versionLine}/${fullVersion || releaseVersion}` : versionLine || VERSION_UNASSIGNED));
  const version = String(primary?.version || fallback?.version || fullVersion || releaseVersion || versionLine || VERSION_UNASSIGNED);

  return {
    versionLine,
    releaseVersion,
    cycleVersion,
    patchVersion,
    fullVersion,
    releaseKey,
    cycleKey,
    versionKey,
    majorVersion: releaseVersion,
    minorVersion: cycleVersion,
    minorIteration: cycleVersion,
    version,
    versionScene: versionLine,
    majorVersionKey: releaseKey || versionLine || VERSION_UNASSIGNED
  };
}

export function getVersionInfoSnapshot(input?: Partial<VersionInfo>): VersionInfo {
  return mergeVersionInfo(input, {});
}

export function getDisplayVersion(input?: Partial<VersionInfo>): string {
  const info = getVersionInfoSnapshot(input);
  const version = info.fullVersion || info.releaseVersion || VERSION_UNASSIGNED;
  return info.versionLine && version !== VERSION_UNASSIGNED ? `${info.versionLine} / ${version}` : version;
}

export function getFilterToken(level: VersionFilter["level"], key: string): string {
  return key ? `${level}:${key}` : "ALL";
}

export function parseFilterToken(value: string): VersionFilter {
  if (!value || value === "ALL") return { level: "ALL", key: "ALL" };
  const index = value.indexOf(":");
  if (index < 0) return { level: "FULL", key: value };
  return { level: value.slice(0, index) as VersionFilter["level"], key: value.slice(index + 1) };
}

export function buildVersionOptions(lines: string[], releases: string[], cycles: string[], fulls: string[]): VersionOption[] {
  return [
    ...lines.sort((a, b) => a.localeCompare(b, "zh-CN")).map((value) => ({ value: getFilterToken("SCENE", value), label: `[大版本线] ${value}` })),
    ...releases.sort((a, b) => a.localeCompare(b, "zh-CN")).map((value) => ({ value: getFilterToken("MAJOR", value), label: `[版本号] ${value}` })),
    ...cycles.sort((a, b) => a.localeCompare(b, "zh-CN")).map((value) => ({ value: getFilterToken("CYCLE", value), label: `[小迭代] ${value}` })),
    ...fulls.sort((a, b) => a.localeCompare(b, "zh-CN")).map((value) => ({ value: getFilterToken("FULL", value), label: `[完整版本] ${value}` }))
  ];
}

export function formatVersionScopeLabel(level: VersionFilter["level"], key: string): string {
  if (level === "ALL") return "全部版本";
  if (level === "SCENE") return `大版本线 ${key}`;
  if (level === "MAJOR") return `版本号 ${key}`;
  if (level === "CYCLE") return `小迭代 ${key}`;
  return `完整版本 ${key}`;
}
