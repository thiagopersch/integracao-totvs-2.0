"use server";

import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/rbac";
import { getDemandAnalystScope } from "@/lib/demand-scope";
import { exportService } from "@/services/export.service";
import { toExportRow } from "@/lib/export-mappers";
import { periodToDateRange, type Period } from "@/lib/period";

async function resolveExportContext(clientId: string, period: Period | null) {
  const ctx = await requirePermission("reports", "read");
  const analystScope = await getDemandAnalystScope(ctx);
  const range = periodToDateRange(period);
  const { demands, effectiveClientIds } = await exportService.getExportDemands(
    ctx.organizationId,
    ctx.allowedClientIds,
    analystScope,
    clientId,
    range
  );
  return { organizationId: ctx.organizationId, demands, effectiveClientIds, range };
}

export async function getDemandExportData(clientId: string, period: Period | null) {
  try {
    const { demands, effectiveClientIds, range, organizationId } = await resolveExportContext(clientId, period);
    const rows = demands.map(toExportRow);
    const charts = await exportService.getExportChartData(organizationId, effectiveClientIds, range);
    return { success: true as const, rows, ...charts };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

export async function exportDemandsXlsx(clientId: string, period: Period | null) {
  try {
    const { demands } = await resolveExportContext(clientId, period);
    const rows = demands.map(toExportRow);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const headers = rows.length ? (Object.keys(rows[0]) as (keyof (typeof rows)[number])[]) : [];
    worksheet["!cols"] = headers.map((h) => ({
      wch: Math.max(String(h).length, ...rows.map((r) => String(r[h] ?? "").length)) + 2,
    }));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Demandas");
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;

    return { success: true as const, base64, fileName: `demandas-${new Date().toISOString().slice(0, 10)}.xlsx` };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
