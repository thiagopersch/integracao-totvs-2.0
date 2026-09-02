import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { assertClientAllowed } from "@/lib/client-access";
import { matchName, type FuzzyCandidate } from "@/lib/fuzzy-match";
import { demandIncludeRelations } from "@/services/demand.service";
import type { FieldMatch, ParsedDemandRow } from "@/schemas/demand-import.schema";
import type { CommitDemandImportRow } from "@/schemas/demand-import.schema";

export interface ImportCandidates {
  clients: FuzzyCandidate[];
  analysts: FuzzyCandidate[];
  requesters: FuzzyCandidate[];
  departments: FuzzyCandidate[];
  demandTypes: FuzzyCandidate[];
}

export const REQUIRED_IMPORT_HEADERS = ["Data", "Nome do analista", "Horas executadas", "Nome da demanda", "Descrição da demanda", "Cliente"] as const;
export const OPTIONAL_IMPORT_HEADERS = ["Solicitante", "Setor", "Tipo de Demanda", "Prioridade", "Status"] as const;

const PRIORITY_LABELS: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" };
const STATUS_LABELS: Record<string, string> = { PENDING: "Pendente", IN_PROGRESS: "Em Andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada" };

function reverseLabel(labels: Record<string, string>, raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  const entry = Object.entries(labels).find(([, label]) => label.toLowerCase() === normalized);
  if (entry) return entry[0];
  const byKey = Object.keys(labels).find((key) => key.toLowerCase() === normalized);
  return byKey ?? null;
}

/** Accepts DD/MM/YYYY (matching `formatDateOnly`'s output) or a native date cell from Excel. */
function parseImportDate(cell: unknown): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return new Date(Date.UTC(cell.getFullYear(), cell.getMonth(), cell.getDate())).toISOString();
  }
  const raw = String(cell ?? "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function parseImportHours(cell: unknown): number | null {
  const raw = String(cell ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = parseFloat(raw);
  if (Number.isNaN(value) || value <= 0) return null;
  return value;
}

function fieldMatch(rawValue: string, candidates: FuzzyCandidate[]): FieldMatch {
  const raw = rawValue.trim();
  const result = matchName(raw, candidates);
  return { rawValue: raw, matchedId: result.matchedId, status: result.status, candidates: result.candidates };
}

export const importService = {
  parseWorkbook(buffer: ArrayBuffer): { headers: string[]; rows: Record<string, unknown>[] } {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
    const headers = rows.length ? Object.keys(rows[0]) : (XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] as string[] | undefined) || [];
    return { headers, rows };
  },

  validateHeaders(headers: string[]): string[] {
    return REQUIRED_IMPORT_HEADERS.filter((h) => !headers.includes(h));
  },

  matchRows(rawRows: Record<string, unknown>[], candidates: ImportCandidates): ParsedDemandRow[] {
    return rawRows.map((raw, index) => {
      const rowNumber = index + 2; // header is row 1
      const errors: string[] = [];

      const dateRaw = String(raw["Data"] ?? "").trim();
      const dateParsed = parseImportDate(raw["Data"]);
      if (!dateParsed) errors.push(`Data inválida: "${dateRaw}"`);

      const hoursRaw = String(raw["Horas executadas"] ?? "").trim();
      const hoursParsed = parseImportHours(raw["Horas executadas"]);
      if (!hoursParsed) errors.push(`Horas inválidas: "${hoursRaw}"`);

      const name = String(raw["Nome da demanda"] ?? "").trim();
      if (!name) errors.push("Nome da demanda é obrigatório");

      const description = String(raw["Descrição da demanda"] ?? "").trim();
      if (!description) errors.push("Descrição da demanda é obrigatória");

      const client = fieldMatch(String(raw["Cliente"] ?? ""), candidates.clients);
      if (!client.rawValue) errors.push("Cliente é obrigatório");

      const analyst = fieldMatch(String(raw["Nome do analista"] ?? ""), candidates.analysts);
      if (!analyst.rawValue) errors.push("Analista é obrigatório");

      const requester = fieldMatch(String(raw["Solicitante"] ?? ""), candidates.requesters);
      const department = fieldMatch(String(raw["Setor"] ?? ""), candidates.departments);

      const demandTypeRaw = String(raw["Tipo de Demanda"] ?? "");
      const demandType = demandTypeRaw.trim()
        ? fieldMatch(demandTypeRaw, candidates.demandTypes)
        : { rawValue: "", matchedId: null, status: "unmatched" as const, candidates: [] };

      const priorityRaw = String(raw["Prioridade"] ?? "");
      const priority = (priorityRaw.trim() ? reverseLabel(PRIORITY_LABELS, priorityRaw) : null) ?? "MEDIUM";

      const statusRaw = String(raw["Status"] ?? "");
      const status = (statusRaw.trim() ? reverseLabel(STATUS_LABELS, statusRaw) : null) ?? "PENDING";

      return {
        rowNumber,
        date: { raw: dateRaw, parsed: dateParsed },
        client,
        analyst,
        requester,
        department,
        demandType,
        name,
        description,
        hours: { raw: hoursRaw, parsed: hoursParsed },
        priority: priority as ParsedDemandRow["priority"],
        status: status as ParsedDemandRow["status"],
        errors,
      };
    });
  },

  async bulkCreate(rows: CommitDemandImportRow[], organizationId: string, allowedClientIds: string[]) {
    const rowErrors: { rowNumber: number; message: string }[] = [];
    const created: { id: string }[] = [];

    await prisma.$transaction(async (tx) => {
      for (const row of rows) {
        try {
          assertClientAllowed(row.clientId, allowedClientIds);
          const demand = await tx.demand.create({
            data: {
              organizationId,
              name: row.name,
              description: row.description,
              date: new Date(row.date),
              durationMinutes: Math.round(row.hours * 60),
              priority: row.priority,
              status: row.status,
              analystId: row.analystId,
              clientId: row.clientId,
              requesterId: row.requesterId || undefined,
              departmentId: row.departmentId || undefined,
              demandTypeId: row.demandTypeId,
            },
            include: demandIncludeRelations,
          });
          created.push({ id: demand.id });
        } catch (error) {
          rowErrors.push({ rowNumber: row.rowNumber, message: (error as Error).message });
        }
      }
      if (rowErrors.length) {
        // Abort the whole transaction on any row failure — a partial import silently mixing
        // committed and rejected rows would be far more confusing to reconcile than re-running
        // the import after the user fixes the flagged rows.
        throw new ImportPartialFailure(rowErrors);
      }
    });

    return { count: created.length };
  },
};

export class ImportPartialFailure extends Error {
  constructor(public rowErrors: { rowNumber: number; message: string }[]) {
    super("Falha ao importar uma ou mais linhas");
    this.name = "ImportPartialFailure";
  }
}
