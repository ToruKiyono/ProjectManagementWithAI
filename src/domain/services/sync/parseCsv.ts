export function splitCsvLine(line: string): string[] {
  const output: string[] = [];
  let current = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuote && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuote = !inQuote;
      }
    } else if (char === "," && !inQuote) {
      output.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  output.push(current);
  return output;
}

export function parseCsv(text: string): Array<Record<string, unknown>> {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (!rows.length) return [];
  const headers = splitCsvLine(rows[0]).map((header) => header.trim());
  return rows.slice(1).map((line) => {
    const values = splitCsvLine(line);
    const item: Record<string, unknown> = {};
    headers.forEach((header, index) => {
      item[header] = (values[index] || "").trim();
    });
    return item;
  });
}
