"use server"

import { updateTag, cacheTag } from "next/cache";
import { dataserverService } from "@/services/dataserver.service";
import { auditService } from "@/services/audit.service";
import { createDataserverSchema, updateDataserverSchema } from "@/schemas/dataserver.schema";
import { requirePermission } from "@/lib/rbac";
import type { ListParams } from "@/types/common";

export async function listDataservers(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("dataservers");
  return dataserverService.list(params, organizationId);
}

export async function getDataserverById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`dataserver-${id}`);
  return dataserverService.getById(id, organizationId);
}

export async function createDataserver(formData: FormData) {
  const { organizationId } = await requirePermission("dataservers", "create");
  const data = {
    code: formData.get("code") as string,
    nameAlternative: formData.get("nameAlternative") as string,
    name: formData.get("name") as string,
  };

  const parsed = createDataserverSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await dataserverService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Dataserver",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("dataservers");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDataserver(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("dataservers", "update");
  const data = {
    code: formData.get("code") as string,
    nameAlternative: formData.get("nameAlternative") as string,
    name: formData.get("name") as string,
  };

  const parsed = updateDataserverSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await dataserverService.getById(id, organizationId);
    const entity = await dataserverService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Dataserver",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    updateTag("dataservers");
    updateTag(`dataserver-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDataserver(id: string) {
  const { organizationId } = await requirePermission("dataservers", "delete");
  try {
    const old = await dataserverService.getById(id, organizationId);
    await dataserverService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Dataserver",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    updateTag("dataservers");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreDataserver(id: string) {
  const { organizationId } = await requirePermission("dataservers", "update");
  try {
    await dataserverService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Dataserver", entityId: id });
    updateTag("dataservers");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteDataservers(ids: string[]) {
  const { organizationId } = await requirePermission("dataservers", "delete");
  try {
    const count = await dataserverService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Dataserver",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("dataservers");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreDataservers(ids: string[]) {
  const { organizationId } = await requirePermission("dataservers", "update");
  try {
    const count = await dataserverService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Dataserver",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("dataservers");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
