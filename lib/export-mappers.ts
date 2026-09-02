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

/** Column order matches the required export spec exactly — reused by both XLSX and PDF so the two
 *  formats never drift out of sync. */
export function toExportRow(d: DemandForExport): ExportRow {
  return {
    Data: formatDateOnly(d.date),
    "Nome do analista": d.analyst?.name ?? "",
    "Horas executadas": Math.round((d.durationMinutes / 60) * 100) / 100,
    "Nome da demanda": d.name,
    "Descrição da demanda": d.description,
    Solicitante: d.requester?.name ?? "",
    Setor: d.department?.name ?? "",
    Cliente: d.client?.name ?? "",
  };
}
