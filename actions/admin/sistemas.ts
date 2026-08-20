"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { sistemaService } from "@/services/sistema.service";
import { auditService } from "@/services/audit.service";
import { createSistemaSchema, updateSistemaSchema } from "@/schemas/sistema.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
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
    revalidateTag("sistemas", "max");
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
    revalidateTag("sistemas", "max");
    revalidateTag(`sistema-${id}`, "max");
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
    revalidateTag("sistemas", "max");
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
    revalidateTag("sistemas", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSistemas(ids: string[]) {
  const { organizationId } = await requirePermission("sistemas", "delete");
  try {
    const count = await sistemaService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "TotvsSystem",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("sistemas", "max");
    return { success: true, count };
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
    revalidateTag("sistemas", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
