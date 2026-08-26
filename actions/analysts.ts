"use server"

import { updateTag, cacheTag } from "next/cache";
import { analystService } from "@/services/analyst.service";
import { auditService } from "@/services/audit.service";
import { createAnalystSchema, updateAnalystSchema } from "@/schemas/analyst.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listAllAnalysts() {
  const { organizationId } = await getRequestContext();
  return analystService.listAll(organizationId);
}

export async function listAnalysts(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("analysts");
  return analystService.list(params, organizationId);
}

function parseAnalystForm(formData: FormData) {
  return {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    role: (formData.get("role") as string) || undefined,
    hourlyRate: formData.get("hourlyRate") ? Number(formData.get("hourlyRate")) : undefined,
    team: (formData.get("team") as string) || undefined,
    color: (formData.get("color") as string) || "#6366f1",
    level: formData.get("level") ? Number(formData.get("level")) : 1,
    status: formData.get("status") === "true",
  };
}

export async function createAnalyst(formData: FormData) {
  const { organizationId } = await requirePermission("analysts", "create");
  const parsed = createAnalystSchema.safeParse(parseAnalystForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await analystService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "Analyst", entityId: entity.id, newData: { name: entity.name } });
    updateTag("analysts");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateAnalyst(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("analysts", "update");
  const parsed = updateAnalystSchema.safeParse(parseAnalystForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await analystService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "Analyst", entityId: id, newData: { name: entity.name } });
    updateTag("analysts");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteAnalyst(id: string) {
  const { organizationId } = await requirePermission("analysts", "delete");
  try {
    await analystService.softDelete(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "Analyst", entityId: id });
    updateTag("analysts");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteAnalysts(ids: string[]) {
  const { organizationId, userId } = await requirePermission("analysts", "delete");
  try {
    const result = await analystService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Analyst",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Analyst", result.blocked, organizationId, userId);
    }
    updateTag("analysts");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
