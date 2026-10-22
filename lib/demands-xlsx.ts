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
  /** COMPLETED demands. */
  executedMinutes: number;
  /** PENDING + IN_PROGRESS demands ("horas programadas"). */
  scheduledMinutes: number;
  /** Monthly allowance (contract + extra hours) — absent when the client has no contract in force. */
  usage?: { baseHours: number; extraHours: number; contractedHours: number } | null;
}

const hoursNumber = (minutes: number) => Math.round((minutes / 60) * 100) / 100;
const round2 = (n: number) => Math.round(n * 100) / 100;
const percentOf = (usedHours: number, contractedHours: number) => (contractedHours > 0 ? round2((usedHours / contractedHours) * 100) : "");

/**
 * ALL_CLIENTS demands report: a "Resumo" sheet (per client: demands, executed/scheduled hours,
 * contract + extra hours and consumption %, plus a total row) and one sheet per client. "Horas
 * extras" only shows up when some client has extra hours launched for the month.
 */
export function demandsByClientXlsxBuffer(groups: ClientDemandsGroup[]): Buffer {
  const workbook = XLSX.utils.book_new();
  const withExtras = groups.some((g) => (g.usage?.extraHours ?? 0) > 0);
  const summaryRow = (
    clientName: string,
    demands: number,
    executedMinutes: number,
    scheduledMinutes: number,
    usage: ClientDemandsGroup["usage"]
  ) => ({
    Cliente: clientName,
    Demandas: demands,
    "Horas executadas": hoursNumber(executedMinutes),
    "Horas programadas": hoursNumber(scheduledMinutes),
    "Horas do contrato": usage ? usage.baseHours : "",
    ...(withExtras ? { "Horas extras": usage ? usage.extraHours : "" } : {}),
    "Horas contratadas": usage ? usage.contractedHours : "",
    "Consumo (%)": usage ? percentOf(hoursNumber(executedMinutes), usage.contractedHours) : "",
  });
  const summary = groups.map((g) => summaryRow(g.clientName, g.rows.length, g.executedMinutes, g.scheduledMinutes, g.usage));
  // Contract totals (and the total %) only count the clients that have a contract.
  const contracted = groups.filter((g) => g.usage);
  const totalUsage = contracted.length
    ? {
        baseHours: round2(contracted.reduce((sum, g) => sum + g.usage!.baseHours, 0)),
        extraHours: round2(contracted.reduce((sum, g) => sum + g.usage!.extraHours, 0)),
        contractedHours: round2(contracted.reduce((sum, g) => sum + g.usage!.contractedHours, 0)),
      }
    : null;
  const total = summaryRow(
    "Total",
    groups.reduce((sum, g) => sum + g.rows.length, 0),
    groups.reduce((sum, g) => sum + g.executedMinutes, 0),
    groups.reduce((sum, g) => sum + g.scheduledMinutes, 0),
    totalUsage
  );
  if (totalUsage) {
    const contractedExecuted = hoursNumber(contracted.reduce((sum, g) => sum + g.executedMinutes, 0));
    total["Consumo (%)"] = percentOf(contractedExecuted, totalUsage.contractedHours);
  }
  summary.push(total);
  const used = new Set(["resumo"]);
  XLSX.utils.book_append_sheet(workbook, autoSizedSheet(summary, Object.keys(summary[0])), "Resumo");
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
