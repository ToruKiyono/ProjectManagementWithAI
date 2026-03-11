import * as XLSX from "xlsx";
import { parseCsv } from "./parseCsv";

function getExtension(fileName: string): string {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export async function parseTabularFile(file: File): Promise<Array<Record<string, unknown>>> {
  const extension = getExtension(file.name);
  if (extension === ".csv") {
    return parseCsv(await file.text());
  }

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false
  });
}
