"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { tbcService } from "@/services/tbc.service";
import { auditService } from "@/services/audit.service";
import { createTbcSchema, updateTbcSchema } from "@/schemas/tbc.schema";
import type { ListParams } from "@/types/common";

export async function listAllTbcs() {
  "use cache";
  cacheTag("tbcs");
  return tbcService.listAll();
}

export async function listTbcs(params: ListParams) {
  "use cache";
  cacheTag("tbcs");
  return tbcService.list(params);
}

export async function getTbcById(id: string) {
  "use cache";
  cacheTag(`tbc-${id}`);
  return tbcService.getById(id);
}

export async function createTbc(formData: FormData) {
  const data = {
    clientId: formData.get("clientId") as string,
    name: formData.get("name") as string,
    link: formData.get("link") as string,
    user: formData.get("user") as string,
    password: formData.get("password") as string,
    notRequiredLicense: formData.get("notRequiredLicense") === "true",
    status: formData.get("status") === "true",
  };

  const parsed = createTbcSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await tbcService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "Tbc",
      entityId: entity.id,
      newData: { name: entity.name, link: entity.link },
    });
    revalidateTag("tbcs", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTbc(id: string, formData: FormData) {
  const data = {
    clientId: formData.get("clientId") as string,
    name: formData.get("name") as string,
    link: formData.get("link") as string,
    user: formData.get("user") as string,
    password: formData.get("password") as string,
    notRequiredLicense: formData.get("notRequiredLicense") === "true",
    status: formData.get("status") === "true",
  };

  const parsed = updateTbcSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await tbcService.getById(id);
    const entity = await tbcService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "Tbc",
      entityId: id,
      oldData: old ? { name: old.name, link: old.link } : undefined,
      newData: { name: entity.name, link: entity.link },
    });
    revalidateTag("tbcs", "max");
    revalidateTag(`tbc-${id}`, "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTbc(id: string) {
  try {
    const old = await tbcService.getById(id);
    await tbcService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "Tbc",
      entityId: id,
      oldData: old ? { name: old.name, link: old.link } : undefined,
    });
    revalidateTag("tbcs", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreTbc(id: string) {
  try {
    await tbcService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Tbc", entityId: id });
    revalidateTag("tbcs", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteTbcs(ids: string[]) {
  try {
    const count = await tbcService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Tbc",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("tbcs", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreTbcs(ids: string[]) {
  try {
    const count = await tbcService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Tbc",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("tbcs", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
