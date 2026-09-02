import { z } from "zod";

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"] as const;

export type MatchStatus = "matched" | "ambiguous" | "unmatched";

export interface MatchCandidate {
  id: string;
  label: string;
}

/** Result of trying to resolve one spreadsheet cell (e.g. "Cliente") against a DB entity list. */
export interface FieldMatch {
  rawValue: string;
  matchedId: string | null;
  status: MatchStatus;
  /** Populated when ambiguous (top candidates) so the UI can hint a pick. */
  candidates: MatchCandidate[];
}

/** One row parsed from the uploaded spreadsheet, annotated with match results — nothing written to DB yet. */
export interface ParsedDemandRow {
  rowNumber: number;
  date: { raw: string; parsed: string | null };
  client: FieldMatch;
  analyst: FieldMatch;
  requester: FieldMatch;
  department: FieldMatch;
  demandType: FieldMatch;
  name: string;
  description: string;
  hours: { raw: string; parsed: number | null };
  priority: (typeof PRIORITIES)[number];
  status: (typeof STATUSES)[number];
  errors: string[];
}

export interface ParseDemandImportResult {
  headers: string[];
  rows: ParsedDemandRow[];
}

export const commitDemandImportRowSchema = z.object({
  rowNumber: z.number(),
  date: z.string().min(1, "Data é obrigatória"),
  clientId: z.string().min(1, "Cliente é obrigatório"),
  analystId: z.string().min(1, "Analista é obrigatório"),
  requesterId: z.string().min(1).optional(),
  departmentId: z.string().min(1).optional(),
  demandTypeId: z.string().min(1, "Tipo de demanda é obrigatório"),
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().min(1, "Descrição é obrigatória"),
  hours: z.number().positive("Horas devem ser maiores que zero"),
  priority: z.enum(PRIORITIES),
  status: z.enum(STATUSES),
});

export const commitDemandImportSchema = z.object({
  rows: z.array(commitDemandImportRowSchema).min(1, "Nenhuma linha para importar"),
});

export type CommitDemandImportRow = z.output<typeof commitDemandImportRowSchema>;
export type CommitDemandImportInput = z.output<typeof commitDemandImportSchema>;
