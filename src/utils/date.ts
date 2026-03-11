export function toDateStr(input: unknown): string {
  if (!input) return "";
  const raw = String(input);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function dateNum(input: string): number | null {
  if (!input) return null;
  const value = new Date(`${input}T00:00:00`).getTime();
  return Number.isNaN(value) ? null : value;
}

export function daysBetween(start: string, end: string): number | null {
  const s = dateNum(start);
  const e = dateNum(end);
  if (s === null || e === null) return null;
  return Math.floor((e - s) / 86400000);
}

export function formatDateFromMs(ms: number): string {
  const date = new Date(ms);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayLocalStr(): string {
  return formatDateFromMs(Date.now());
}

export function shortDate(input: string): string {
  return input.length >= 10 ? input.slice(5) : input;
}
