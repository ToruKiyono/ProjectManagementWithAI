export function pickFirst(source: Record<string, unknown>, keys: string[]): unknown {
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return "";
}

export function splitTags(input: unknown): string[] {
  const raw = String(input ?? "").trim();
  if (!raw) return [];
  return raw.split(/[;,，、\s]+/).map((item) => item.trim()).filter(Boolean);
}

export function clampNumber(input: unknown, min: number, max: number): number {
  const value = Number(input ?? 0);
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function safeClone<T>(input: T): T {
  return JSON.parse(JSON.stringify(input)) as T;
}

export function countBy<T>(items: T[], getter: (item: T) => string, seeds: string[] = []): Record<string, number> {
  const result: Record<string, number> = {};
  seeds.forEach((seed) => {
    result[seed] = 0;
  });
  items.forEach((item) => {
    const key = getter(item) || "未分配";
    result[key] = (result[key] || 0) + 1;
  });
  return result;
}
