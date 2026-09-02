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

type CanonicalField =
  | "date"
  | "analyst"
  | "hours"
  | "name"
  | "description"
  | "requester"
  | "department"
  | "client"
  | "demandType"
  | "priority"
  | "status";

/**
 * Real-world spreadsheets (e.g. partner-provided monthly timesheets like the "Rubeus" apontamento
 * template) don't share a single fixed header label — "DEMANDA" vs "Nome da demanda", "DESCRIÇÃO "
 * vs "Descrição da demanda" — so every accepted spreadsheet header is normalized (trim + uppercase)
 * and matched against this alias list rather than requiring an exact column name.
 */
const HEADER_ALIASES: Record<CanonicalField, string[]> = {
  date: ["DATA"],
  analyst: ["NOME DO ANALISTA", "ANALISTA"],
  hours: ["HORAS EXECUTADAS", "HORAS"],
  name: ["NOME DA DEMANDA", "DEMANDA"],
  description: ["DESCRIÇÃO DA DEMANDA", "DESCRIÇÃO"],
  requester: ["SOLICITANTE"],
  department: ["SETOR"],
  client: ["CLIENTE"],
  demandType: ["TIPO DE DEMANDA"],
  priority: ["PRIORIDADE"],
  status: ["STATUS"],
};

const REQUIRED_FIELDS: CanonicalField[] = ["date", "analyst", "hours", "name", "description", "client"];
const REQUIRED_FIELD_LABELS: Record<CanonicalField, string> = {
  date: "Data",
  analyst: "Nome do analista / Analista",
  hours: "Horas executadas / Horas",
  name: "Nome da demanda / Demanda",
  description: "Descrição da demanda / Descrição",
  requester: "Solicitante",
  department: "Setor",
  client: "Cliente",
  demandType: "Tipo de Demanda",
  priority: "Prioridade",
  status: "Status",
};

const PRIORITY_LABELS: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" };
const STATUS_LABELS: Record<string, string> = { PENDING: "Pendente", IN_PROGRESS: "Em Andamento", COMPLETED: "Concluída", CANCELLED: "Cancelada" };

/** How many leading rows of a sheet to scan for a header row before giving up on that sheet
 *  (spreadsheets like the Rubeus template have a title/metadata block above the real header). */
const HEADER_SCAN_LIMIT = 30;

function normalizeHeaderCell(value: unknown): string {
  return String(value ?? "").trim().toUpperCase();
}

function isBlankRow(row: unknown[]): boolean {
  return row.every((cell) => String(cell ?? "").trim() === "");
}

/**
 * Filters out rows that aren't real demand entries — trailing "TOTAL DE HORAS..." footer rows
 * (common in partner timesheet templates), or stray rows left over from a merged/filled-down
 * column with no other content. A genuine data row always has name, description and client filled,
 * so requiring at least one of those to be non-blank is enough to drop footers without risking a
 * real (if incomplete) row silently disappearing instead of being flagged as an error.
 */
function isFillerRow(values: Partial<Record<CanonicalField, unknown>>): boolean {
  const name = String(values.name ?? "").trim();
  const description = String(values.description ?? "").trim();
  const client = String(values.client ?? "").trim();
  return !name && !description && !client;
}

function findColumnMap(headerRow: unknown[]): Map<CanonicalField, number> | null {
  const normalizedCells = headerRow.map(normalizeHeaderCell);
  const map = new Map<CanonicalField, number>();
  for (const field of Object.keys(HEADER_ALIASES) as CanonicalField[]) {
    const idx = normalizedCells.findIndex((cell) => HEADER_ALIASES[field].includes(cell));
    if (idx !== -1) map.set(field, idx);
  }
  return REQUIRED_FIELDS.every((f) => map.has(f)) ? map : null;
}

function reverseLabel(labels: Record<string, string>, raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  const entry = Object.entries(labels).find(([, label]) => label.toLowerCase() === normalized);
  if (entry) return entry[0];
  const byKey = Object.keys(labels).find((key) => key.toLowerCase() === normalized);
  return byKey ?? null;
}

/** Accepts a real Excel date cell (SheetJS `cellDates: true` already converts date-formatted
 *  serials to `Date`) or DD/MM/YYYY text (a user-retyped cell, matching `formatDateOnly`'s output). */
function parseImportDate(cell: unknown): string | null {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    return new Date(Date.UTC(cell.getUTCFullYear(), cell.getUTCMonth(), cell.getUTCDate())).toISOString();
  }
  const raw = String(cell ?? "").trim();
  const match = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatCellForDisplay(cell: unknown): string {
  if (cell instanceof Date && !Number.isNaN(cell.getTime())) {
    const day = String(cell.getUTCDate()).padStart(2, "0");
    const month = String(cell.getUTCMonth() + 1).padStart(2, "0");
    return `${day}/${month}/${cell.getUTCFullYear()}`;
  }
  return String(cell ?? "").trim();
}

/** Cells arrive as native numbers (SheetJS default) or, for hand-edited text, comma/period decimals. */
function parseImportHours(cell: unknown): number | null {
  if (typeof cell === "number") return cell > 0 ? cell : null;
  const raw = String(cell ?? "").trim().replace(",", ".");
  if (!raw) return null;
  const value = parseFloat(raw);
  return Number.isNaN(value) || value <= 0 ? null : value;
}

function fieldMatch(rawValue: string, candidates: FuzzyCandidate[]): FieldMatch {
  const raw = rawValue.trim();
  const result = matchName(raw, candidates);
  return { rawValue: raw, matchedId: result.matchedId, status: result.status, candidates: result.candidates };
}

interface SheetRow {
  sheetName: string;
  sheetRowIndex: number;
  values: Partial<Record<CanonicalField, unknown>>;
}

export interface ParsedWorkbook {
  rows: SheetRow[];
  headerFound: boolean;
}

export const importService = {
  /**
   * Scans every sheet of the workbook for a header row (via `HEADER_ALIASES`) and collects the
   * data rows below it — supports multi-tab monthly timesheets (one sheet per month) where each
   * sheet carries its own metadata block before the real column headers, and silently skips any
   * sheet where no recognizable header row is found (e.g. a summary/cover sheet).
   */
  parseWorkbook(buffer: ArrayBuffer): ParsedWorkbook {
    const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
    const rows: SheetRow[] = [];
    let headerFound = false;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
      if (!matrix.length) continue;

      let columnMap: Map<CanonicalField, number> | null = null;
      let headerRowIndex = -1;
      const scanLimit = Math.min(matrix.length, HEADER_SCAN_LIMIT);
      for (let i = 0; i < scanLimit; i++) {
        const map = findColumnMap(matrix[i]);
        if (map) {
          columnMap = map;
          headerRowIndex = i;
          break;
        }
      }
      if (!columnMap) continue;
      headerFound = true;

      for (let i = headerRowIndex + 1; i < matrix.length; i++) {
        const row = matrix[i];
        if (isBlankRow(row)) continue;
        const values: Partial<Record<CanonicalField, unknown>> = {};
        for (const [field, idx] of columnMap) values[field] = row[idx];
        if (isFillerRow(values)) continue;
        rows.push({ sheetName: sheetName.trim(), sheetRowIndex: i + 1, values });
      }
    }

    return { rows, headerFound };
  },

  validateWorkbook(parsed: ParsedWorkbook): string | null {
    if (!parsed.headerFound) {
      const labels = REQUIRED_FIELDS.map((f) => REQUIRED_FIELD_LABELS[f]).join(", ");
      return `Não foi possível localizar as colunas obrigatórias (${labels}) em nenhuma aba da planilha.`;
    }
    if (!parsed.rows.length) return "A planilha não contém linhas de dados para importar.";
    return null;
  },

  matchRows(sheetRows: SheetRow[], candidates: ImportCandidates): ParsedDemandRow[] {
    return sheetRows.map((sheetRow, index) => {
      const rowNumber = index + 1;
      const v = sheetRow.values;
      const errors: string[] = [];

      const dateRaw = formatCellForDisplay(v.date);
      const dateParsed = parseImportDate(v.date);
      if (!dateParsed) errors.push(`Data inválida: "${dateRaw}"`);

      const hoursRaw = formatCellForDisplay(v.hours);
      const hoursParsed = parseImportHours(v.hours);
      if (!hoursParsed) errors.push(`Horas inválidas: "${hoursRaw}"`);

      const name = String(v.name ?? "").trim();
      if (!name) errors.push("Nome da demanda é obrigatório");

      const description = String(v.description ?? "").trim();
      if (!description) errors.push("Descrição da demanda é obrigatória");

      const client = fieldMatch(String(v.client ?? ""), candidates.clients);
      if (!client.rawValue) errors.push("Cliente é obrigatório");

      const analyst = fieldMatch(String(v.analyst ?? ""), candidates.analysts);
      if (!analyst.rawValue) errors.push("Analista é obrigatório");

      const requester = fieldMatch(String(v.requester ?? ""), candidates.requesters);
      const department = fieldMatch(String(v.department ?? ""), candidates.departments);

      const demandTypeRaw = String(v.demandType ?? "");
      const demandType = demandTypeRaw.trim()
        ? fieldMatch(demandTypeRaw, candidates.demandTypes)
        : { rawValue: "", matchedId: null, status: "unmatched" as const, candidates: [] };

      const priorityRaw = String(v.priority ?? "");
      const priority = (priorityRaw.trim() ? reverseLabel(PRIORITY_LABELS, priorityRaw) : null) ?? "MEDIUM";

      const statusRaw = String(v.status ?? "");
      const status = (statusRaw.trim() ? reverseLabel(STATUS_LABELS, statusRaw) : null) ?? "PENDING";

      return {
        rowNumber,
        sourceLabel: `${sheetRow.sheetName} · linha ${sheetRow.sheetRowIndex}`,
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
