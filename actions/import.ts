"use server";

import { updateTag } from "next/cache";
import { requirePermission } from "@/lib/rbac";
import { listAllClients } from "@/actions/admin/clients";
import { listAllAnalysts } from "@/actions/analysts";
import { listAllRequesters } from "@/actions/requesters";
import { listAllDepartments } from "@/actions/departments";
import { listAllDemandTypes } from "@/actions/demand-types";
import { auditService } from "@/services/audit.service";
import { importService, ImportPartialFailure, type ImportCandidates } from "@/services/import.service";
import { commitDemandImportSchema } from "@/schemas/demand-import.schema";
import type { ParsedDemandRow } from "@/schemas/demand-import.schema";

const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".xlsx", ".xls", ".csv"];

async function loadImportCandidates(): Promise<ImportCandidates> {
  const [clients, analysts, requesters, departments, demandTypes] = await Promise.all([
    listAllClients(),
    listAllAnalysts(),
    listAllRequesters(),
    listAllDepartments(),
    listAllDemandTypes(),
  ]);

  return {
    clients: clients.map((c) => ({ id: c.id, name: c.name, aliases: [c.legalName] })),
    analysts: analysts.map((a) => ({ id: a.id, name: a.name })),
    requesters: requesters.map((r) => ({ id: r.id, name: r.name })),
    departments: departments.map((d) => ({ id: d.id, name: d.name })),
    demandTypes: demandTypes.map((t) => ({ id: t.id, name: t.name })),
  };
}

export async function parseDemandImport(
  formData: FormData
): Promise<{ success: true; fileName: string; rows: ParsedDemandRow[] } | { success: false; error: string }> {
  await requirePermission("demands", "create");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { success: false, error: "Nenhum arquivo selecionado" };
  if (file.size > MAX_IMPORT_FILE_SIZE) return { success: false, error: "Arquivo excede o limite de 5MB" };
  const hasValidExtension = ALLOWED_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
  if (!hasValidExtension) return { success: false, error: "Formato inválido. Envie um arquivo .xlsx, .xls ou .csv" };

  try {
    const buffer = await file.arrayBuffer();
    const { headers, rows } = importService.parseWorkbook(buffer);
    if (!rows.length) return { success: false, error: "A planilha não contém linhas de dados" };

    const missingHeaders = importService.validateHeaders(headers);
    if (missingHeaders.length) {
      return { success: false, error: `Colunas obrigatórias ausentes: ${missingHeaders.join(", ")}` };
    }

    const candidates = await loadImportCandidates();
    const parsedRows = importService.matchRows(rows, candidates);
    return { success: true, fileName: file.name, rows: parsedRows };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function commitDemandImport(
  input: unknown
): Promise<{ success: true; createdCount: number } | { success: false; error: string; rowErrors?: { rowNumber: number; message: string }[] }> {
  const ctx = await requirePermission("demands", "create");

  const parsed = commitDemandImportSchema.safeParse(input);
  if (!parsed.success) {
    const rowErrors = parsed.error.issues
      .map((issue) => {
        const rowIndex = typeof issue.path[1] === "number" ? issue.path[1] : null;
        const row = rowIndex !== null ? (input as { rows?: { rowNumber?: number }[] })?.rows?.[rowIndex] : null;
        return row?.rowNumber !== undefined ? { rowNumber: row.rowNumber, message: issue.message } : null;
      })
      .filter((e): e is { rowNumber: number; message: string } => e !== null);
    return { success: false, error: "Dados inválidos", rowErrors };
  }

  try {
    const result = await importService.bulkCreate(parsed.data.rows, ctx.organizationId, ctx.allowedClientIds);
    await auditService.log({ action: "CREATE", entity: "Demand", entityId: "bulk-import", newData: { count: result.count } });
    updateTag("demands");
    return { success: true, createdCount: result.count };
  } catch (error) {
    if (error instanceof ImportPartialFailure) {
      return { success: false, error: error.message, rowErrors: error.rowErrors };
    }
    return { success: false, error: (error as Error).message };
  }
}
