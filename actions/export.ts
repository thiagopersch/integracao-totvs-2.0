"use server";

import { requirePermission } from "@/lib/rbac";
import { getDemandAnalystScope } from "@/lib/demand-scope";
import { exportService } from "@/services/export.service";
import { toExportRow } from "@/lib/export-mappers";
import { demandsXlsxBase64 } from "@/lib/demands-xlsx";
import { resolveExportPeriodRange, type ExportPeriod } from "@/lib/export-period";

async function resolveExportContext(clientIds: string[], period: ExportPeriod | null) {
  const ctx = await requirePermission("reports", "read");
  const analystScope = await getDemandAnalystScope(ctx);
  const range = resolveExportPeriodRange(period);
  const { demands, effectiveClientIds } = await exportService.getExportDemands(
    ctx.organizationId,
    ctx.allowedClientIds,
    analystScope,
    clientIds,
    range
  );
  return { organizationId: ctx.organizationId, demands, effectiveClientIds, range };
}

export async function getDemandExportData(clientIds: string[], period: ExportPeriod | null) {
  try {
    const { demands, effectiveClientIds, range, organizationId } = await resolveExportContext(clientIds, period);
    const rows = demands.map(toExportRow);
    const charts = await exportService.getExportChartData(organizationId, effectiveClientIds, range);
    return { success: true as const, rows, ...charts };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

export async function exportDemandsXlsx(clientIds: string[], period: ExportPeriod | null) {
  try {
    const { demands } = await resolveExportContext(clientIds, period);
    const base64 = demandsXlsxBase64(demands.map(toExportRow));

    return { success: true as const, base64, fileName: `demandas-${new Date().toISOString().slice(0, 10)}.xlsx` };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
