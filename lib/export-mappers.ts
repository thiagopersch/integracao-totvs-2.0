import type { Prisma } from "@/generated/prisma/client";
import type { demandIncludeRelations } from "@/services/demand.service";
import { formatDateOnly } from "@/utils/format";

export type DemandForExport = Prisma.DemandGetPayload<{ include: typeof demandIncludeRelations }>;

export interface ExportRow {
  Data: string;
  "Nome do analista": string;
  "Horas executadas": number;
  "Nome da demanda": string;
  "Descrição da demanda": string;
  Solicitante: string;
  Setor: string;
  Cliente: string;
}

/** Decodes SQL Server `FOR XML PATH` / SharePoint style escape codes (e.g. `_x000D_` for carriage
 *  return) that leak into imported text as literal characters instead of real control characters,
 *  then normalizes the resulting line breaks so the text reads cleanly once exported. */
export function decodeExcelEscapedText(value: string): string {
  if (!value) return value;
  return value
    .replace(/_x([0-9A-Fa-f]{4})_/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]*\n[ \t]*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/** Column order matches the required export spec exactly — reused by both XLSX and PDF so the two
 *  formats never drift out of sync. */
export function toExportRow(d: DemandForExport): ExportRow {
  return {
    Data: formatDateOnly(d.date),
    "Nome do analista": d.analyst?.name ?? "",
    "Horas executadas": Math.round((d.durationMinutes / 60) * 100) / 100,
    "Nome da demanda": d.name,
    "Descrição da demanda": decodeExcelEscapedText(d.description),
    Solicitante: d.requester?.name ?? "",
    Setor: d.department?.name ?? "",
    Cliente: d.client?.name ?? "",
  };
}
