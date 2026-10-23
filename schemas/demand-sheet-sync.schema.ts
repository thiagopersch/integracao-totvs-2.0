import { z } from "zod";
import { parseSpreadsheetId } from "@/lib/google-sheets";
import { SHEET_SYNC_PERIODS } from "@/lib/report-period";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const demandSheetSyncSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(120, "Nome deve ter no máximo 120 caracteres"),
  spreadsheetUrl: z
    .string()
    .trim()
    .url("Informe o link da planilha")
    .refine((url) => /^https:\/\/docs\.google\.com\//.test(url) && !!parseSpreadsheetId(url), {
      message: "Use o link de uma planilha do Google (https://docs.google.com/spreadsheets/d/...)",
    }),
  period: z.enum(SHEET_SYNC_PERIODS).default("currentMonth"),
  clientIds: z.array(z.string()).default([]),
  analystIds: z.array(z.string()).default([]),
  schedule: z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]).default("DAILY"),
  scheduleTime: z.string().regex(TIME_REGEX, "Horário inválido").nullable().default("08:00"),
  dayOfMonth: z.number().int().min(1).max(31).nullable().default(null),
  syncOnDemandChange: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export type DemandSheetSyncInput = z.output<typeof demandSheetSyncSchema>;
