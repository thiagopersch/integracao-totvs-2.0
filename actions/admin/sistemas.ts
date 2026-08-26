"use server"

import { updateTag, cacheTag } from "next/cache";
import { sistemaService } from "@/services/sistema.service";
import { auditService } from "@/services/audit.service";
import { createSistemaSchema, updateSistemaSchema } from "@/schemas/sistema.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listAllSistemas() {
  const { organizationId } = await getRequestContext();
  return sistemaService.listAll(organizationId);
}

export async function listSistemas(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("sistemas");
  return sistemaService.list(params, organizationId);
}

export async function getSistemaById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`sistema-${id}`);
  return sistemaService.getById(id, organizationId);
}

export async function createSistema(formData: FormData) {
  const { organizationId } = await requirePermission("sistemas", "create");
  const data = {
    code: formData.get("code") as string,
    internalName: formData.get("internalName") as string,
    externalName: formData.get("externalName") as string,
  };

  const parsed = createSistemaSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await sistemaService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "TotvsSystem",
      entityId: entity.id,
      newData: { code: entity.code, internalName: entity.internalName },
    });
    updateTag("sistemas");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSistema(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("sistemas", "update");
  const data = {
    code: formData.get("code") as string,
    internalName: formData.get("internalName") as string,
    externalName: formData.get("externalName") as string,
  };

  const parsed = updateSistemaSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await sistemaService.getById(id, organizationId);
    const entity = await sistemaService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "TotvsSystem",
      entityId: id,
      oldData: old ? { code: old.code, internalName: old.internalName } : undefined,
      newData: { code: entity.code, internalName: entity.internalName },
    });
    updateTag("sistemas");
    updateTag(`sistema-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSistema(id: string) {
  const { organizationId } = await requirePermission("sistemas", "delete");
  try {
    const old = await sistemaService.getById(id, organizationId);
    await sistemaService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "TotvsSystem",
      entityId: id,
      oldData: old ? { code: old.code, internalName: old.internalName } : undefined,
    });
    updateTag("sistemas");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSistema(id: string) {
  const { organizationId } = await requirePermission("sistemas", "update");
  try {
    await sistemaService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "TotvsSystem", entityId: id });
    updateTag("sistemas");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSistemas(ids: string[]) {
  const { organizationId, userId } = await requirePermission("sistemas", "delete");
  try {
    const result = await sistemaService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "TotvsSystem",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("TotvsSystem", result.blocked, organizationId, userId);
    }
    updateTag("sistemas");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreSistemas(ids: string[]) {
  const { organizationId } = await requirePermission("sistemas", "update");
  try {
    const count = await sistemaService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "TotvsSystem",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("sistemas");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
