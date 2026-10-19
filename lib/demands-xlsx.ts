import * as XLSX from "xlsx";
import type { ExportRow } from "@/lib/export-mappers";

/** Sheet with columns sized to their content. */
export function autoSizedSheet<T extends object>(rows: T[], header?: string[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows, header ? { header } : undefined);
  const headers = header ?? (rows.length ? Object.keys(rows[0]) : []);
  worksheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length, ...rows.map((r) => String((r as Record<string, unknown>)[h] ?? "").length)) + 2,
  }));
  return worksheet;
}

function buildWorkbook(rows: ExportRow[]) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, autoSizedSheet(rows), "Demandas");
  return workbook;
}

/**
 * Excel sheet names: max 31 chars, none of `[]:*?/\`, unique (case-insensitive), not "Resumo"
 * (reserved for the summary sheet).
 */
export function uniqueSheetName(name: string, used: Set<string>): string {
  const base = name.replace(/[[\]:*?/\\]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 31) || "Cliente";
  let candidate = base;
  for (let i = 2; used.has(candidate.toLowerCase()); i++) {
    const suffix = ` (${i})`;
    candidate = `${base.slice(0, 31 - suffix.length)}${suffix}`;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

export interface ClientDemandsGroup {
  clientName: string;
  rows: ExportRow[];
  /** Total minutes of the client's demands in the period. */
  minutes: number;
}

const hoursNumber = (minutes: number) => Math.round((minutes / 60) * 100) / 100;

/** ALL_CLIENTS demands report: a "Resumo" sheet (client, demands, hours + total) and one sheet per client. */
export function demandsByClientXlsxBuffer(groups: ClientDemandsGroup[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const summary = groups.map((g) => ({ Cliente: g.clientName, Demandas: g.rows.length, Horas: hoursNumber(g.minutes) }));
  summary.push({
    Cliente: "Total",
    Demandas: groups.reduce((sum, g) => sum + g.rows.length, 0),
    Horas: hoursNumber(groups.reduce((sum, g) => sum + g.minutes, 0)),
  });
  const used = new Set(["resumo"]);
  XLSX.utils.book_append_sheet(workbook, autoSizedSheet(summary, ["Cliente", "Demandas", "Horas"]), "Resumo");
  for (const group of groups) {
    XLSX.utils.book_append_sheet(workbook, autoSizedSheet(group.rows), uniqueSheetName(group.clientName, used));
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** The "Exportar demandas" spreadsheet — shared by the download (base64) and email attachments (Buffer). */
export function demandsXlsxBase64(rows: ExportRow[]): string {
  return XLSX.write(buildWorkbook(rows), { type: "base64", bookType: "xlsx" }) as string;
}

export function demandsXlsxBuffer(rows: ExportRow[]): Buffer {
  return XLSX.write(buildWorkbook(rows), { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
