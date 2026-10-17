import * as XLSX from "xlsx";
import type { ExportRow } from "@/lib/export-mappers";

function buildWorkbook(rows: ExportRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const headers = rows.length ? (Object.keys(rows[0]) as (keyof ExportRow)[]) : [];
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.max(String(h).length, ...rows.map((r) => String(r[h] ?? "").length)) + 2,
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Demandas");
  return workbook;
}

/** The "Exportar demandas" spreadsheet — shared by the download (base64) and email attachments (Buffer). */
export function demandsXlsxBase64(rows: ExportRow[]): string {
  return XLSX.write(buildWorkbook(rows), { type: "base64", bookType: "xlsx" }) as string;
}

export function demandsXlsxBuffer(rows: ExportRow[]): Buffer {
  return XLSX.write(buildWorkbook(rows), { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
