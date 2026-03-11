export function parseRichTextDescription(input: unknown): string {
  try {
    if (input === undefined || input === null) return "";
    if (Array.isArray(input)) {
      return input.map((item) => parseRichTextDescription(item)).filter(Boolean).join("\n");
    }
    if (typeof input === "object") {
      const record = input as Record<string, unknown>;
      const preferred = record.value ?? record.content ?? record.text ?? record.title;
      if (preferred !== undefined) return parseRichTextDescription(preferred);
      return Object.values(record).map((item) => parseRichTextDescription(item)).filter(Boolean).join("\n");
    }
    const raw = String(input).trim();
    if (!raw) return "";
    if ((raw.startsWith("[") && raw.endsWith("]")) || (raw.startsWith("{") && raw.endsWith("}"))) {
      try {
        return parseRichTextDescription(JSON.parse(raw)) || raw;
      } catch {
        return raw;
      }
    }
    return raw;
  } catch {
    return String(input ?? "");
  }
}
