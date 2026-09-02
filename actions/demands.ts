"use server"

import { updateTag, cacheTag } from "next/cache";
import { demandService } from "@/services/demand.service";
import { auditService } from "@/services/audit.service";
import { createDemandSchema, updateDemandSchema } from "@/schemas/demand.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { getDemandAnalystScope } from "@/lib/demand-scope";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";
import type { Period } from "@/lib/period";
import { periodToDateRange } from "@/lib/period";

export async function listDemands(
  params: ListParams,
  organizationId: string,
  allowedClientIds: string[],
  analystScope?: string,
  period?: Period | null
) {
  "use cache";
  cacheTag("demands");
  return demandService.list(params, organizationId, allowedClientIds, analystScope, periodToDateRange(period ?? null));
}

export async function getDemandPeriodOptions() {
  const ctx = await getRequestContext();
  const analystScope = await getDemandAnalystScope(ctx);
  return getCachedDemandPeriodOptions(ctx.organizationId, ctx.allowedClientIds, analystScope);
}

async function getCachedDemandPeriodOptions(organizationId: string, allowedClientIds: string[], analystScope?: string) {
  "use cache";
  cacheTag("demands");
  return demandService.getAvailablePeriods(organizationId, allowedClientIds, analystScope);
}

function parseDemandForm(formData: FormData) {
  return {
    name: formData.get("name") as string,
    description: formData.get("description") as string,
    date: formData.get("date") as string,
    startTime: formData.get("startTime") as string,
    endTime: formData.get("endTime") as string,
    priority: formData.get("priority") as string,
    status: formData.get("status") as string,
    notes: (formData.get("notes") as string) || undefined,
    analystId: formData.get("analystId") as string,
    clientId: formData.get("clientId") as string,
    requesterId: (formData.get("requesterId") as string) || undefined,
    departmentId: (formData.get("departmentId") as string) || undefined,
    demandTypeId: (formData.get("demandTypeId") as string) || undefined,
    tagIds: formData.getAll("tagIds") as string[],
  };
}

export async function createDemand(formData: FormData) {
  const ctx = await requirePermission("demands", "create");
  const parsed = createDemandSchema.safeParse(parseDemandForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  const scope = await getDemandAnalystScope(ctx);
  if (scope && parsed.data.analystId !== scope) {
    return { success: false, error: "Você só pode criar demandas para si mesmo" };
  }

  try {
    const entity = await demandService.create(parsed.data, ctx.organizationId, ctx.allowedClientIds);
    await auditService.log({ action: "CREATE", entity: "Demand", entityId: entity.id, newData: { name: entity.name } });
    updateTag("demands");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDemand(id: string, formData: FormData) {
  const ctx = await requirePermission("demands", "update");
  const parsed = updateDemandSchema.safeParse(parseDemandForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await demandService.update(id, parsed.data, ctx.organizationId, ctx.allowedClientIds);
    await auditService.log({ action: "UPDATE", entity: "Demand", entityId: id, newData: { name: entity.name } });
    updateTag("demands");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDemand(id: string) {
  const { organizationId, allowedClientIds } = await requirePermission("demands", "delete");
  try {
    await demandService.softDelete(id, organizationId, allowedClientIds);
    await auditService.log({ action: "DELETE", entity: "Demand", entityId: id });
    updateTag("demands");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteDemands(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("demands", "delete");
  try {
    const result = await demandService.bulkSoftDelete(ids, organizationId, allowedClientIds);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Demand",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Demand", result.blocked, organizationId, userId);
    }
    updateTag("demands");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
