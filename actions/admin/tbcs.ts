"use server"

import { updateTag, cacheTag } from "next/cache";
import { tbcService } from "@/services/tbc.service";
import { auditService } from "@/services/audit.service";
import { createTbcSchema, updateTbcSchema } from "@/schemas/tbc.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import type { ListParams } from "@/types/common";

export async function listAllTbcs() {
  const { organizationId } = await getRequestContext();
  return tbcService.listAll(organizationId);
}

export async function listTbcs(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("tbcs");
  return tbcService.list(params, organizationId);
}

export async function getTbcById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`tbc-${id}`);
  return tbcService.getById(id, organizationId);
}

export async function createTbc(formData: FormData) {
  const { organizationId } = await requirePermission("tbcs", "create");
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
    const entity = await tbcService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Tbc",
      entityId: entity.id,
      newData: { name: entity.name, link: entity.link },
    });
    updateTag("tbcs");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTbc(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("tbcs", "update");
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
    const old = await tbcService.getById(id, organizationId);
    const entity = await tbcService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Tbc",
      entityId: id,
      oldData: old ? { name: old.name, link: old.link } : undefined,
      newData: { name: entity.name, link: entity.link },
    });
    updateTag("tbcs");
    updateTag(`tbc-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTbc(id: string) {
  const { organizationId } = await requirePermission("tbcs", "delete");
  try {
    const old = await tbcService.getById(id, organizationId);
    await tbcService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Tbc",
      entityId: id,
      oldData: old ? { name: old.name, link: old.link } : undefined,
    });
    updateTag("tbcs");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreTbc(id: string) {
  const { organizationId } = await requirePermission("tbcs", "update");
  try {
    await tbcService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Tbc", entityId: id });
    updateTag("tbcs");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteTbcs(ids: string[]) {
  const { organizationId } = await requirePermission("tbcs", "delete");
  try {
    const count = await tbcService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Tbc",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("tbcs");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreTbcs(ids: string[]) {
  const { organizationId } = await requirePermission("tbcs", "update");
  try {
    const count = await tbcService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Tbc",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("tbcs");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
