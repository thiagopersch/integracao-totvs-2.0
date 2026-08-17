"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { dataserverService } from "@/services/dataserver.service";
import { auditService } from "@/services/audit.service";
import { createDataserverSchema, updateDataserverSchema } from "@/schemas/dataserver.schema";
import type { ListParams } from "@/types/common";

export async function listDataservers(params: ListParams) {
  "use cache";
  cacheTag("dataservers");
  return dataserverService.list(params);
}

export async function getDataserverById(id: string) {
  "use cache";
  cacheTag(`dataserver-${id}`);
  return dataserverService.getById(id);
}

export async function createDataserver(formData: FormData) {
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
    const entity = await dataserverService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "Dataserver",
      entityId: entity.id,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("dataservers", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDataserver(id: string, formData: FormData) {
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
    const old = await dataserverService.getById(id);
    const entity = await dataserverService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "Dataserver",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
      newData: { code: entity.code, name: entity.name },
    });
    revalidateTag("dataservers", "max");
    revalidateTag(`dataserver-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDataserver(id: string) {
  try {
    const old = await dataserverService.getById(id);
    await dataserverService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "Dataserver",
      entityId: id,
      oldData: old ? { code: old.code, name: old.name } : undefined,
    });
    revalidateTag("dataservers", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreDataserver(id: string) {
  try {
    await dataserverService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Dataserver", entityId: id });
    revalidateTag("dataservers", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteDataservers(ids: string[]) {
  try {
    const count = await dataserverService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Dataserver",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("dataservers", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreDataservers(ids: string[]) {
  try {
    const count = await dataserverService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Dataserver",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("dataservers", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
