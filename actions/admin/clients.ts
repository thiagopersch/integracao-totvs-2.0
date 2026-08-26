"use server"

import { updateTag, cacheTag } from "next/cache";
import { clientService } from "@/services/client.service";
import { auditService } from "@/services/audit.service";
import { createClientSchema, updateClientSchema } from "@/schemas/client.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { saveImageUpload } from "@/lib/upload";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listAllClients() {
  const { organizationId } = await getRequestContext();
  return clientService.listAll(organizationId);
}

export async function listActiveClientsWithTbc() {
  const { organizationId } = await getRequestContext();
  return clientService.listActiveWithTbc(organizationId);
}

export async function listClients(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("clients");
  return clientService.list(params, organizationId);
}

export async function getClientById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`client-${id}`);
  return clientService.getById(id, organizationId);
}

async function parseClientForm(formData: FormData) {
  const imageValue = formData.get("image");
  const image =
    imageValue instanceof File && imageValue.size > 0
      ? await saveImageUpload(imageValue)
      : (imageValue as string) || undefined;

  return {
    image,
    name: formData.get("name") as string,
    legalName: (formData.get("legalName") as string) || undefined,
    document: (formData.get("document") as string) || "",
    linkCrm: (formData.get("linkCrm") as string) || undefined,
    site: (formData.get("site") as string) || undefined,
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    responsible: (formData.get("responsible") as string) || undefined,
    color: (formData.get("color") as string) || "#22c55e",
    notes: (formData.get("notes") as string) || undefined,
    favorite: formData.get("favorite") === "true",
    status: formData.get("status") === "true",
  };
}

export async function createClient(formData: FormData) {
  const { organizationId } = await requirePermission("clients", "create");
  const parsed = createClientSchema.safeParse(await parseClientForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await clientService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "Client",
      entityId: entity.id,
      newData: { name: entity.name, linkCrm: entity.linkCrm },
    });
    updateTag("clients");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateClient(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("clients", "update");
  const parsed = updateClientSchema.safeParse(await parseClientForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await clientService.getById(id, organizationId);
    const entity = await clientService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "Client",
      entityId: id,
      oldData: old ? { name: old.name, linkCrm: old.linkCrm } : undefined,
      newData: { name: entity.name, linkCrm: entity.linkCrm },
    });
    updateTag("clients");
    updateTag(`client-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteClient(id: string) {
  const { organizationId } = await requirePermission("clients", "delete");
  try {
    const old = await clientService.getById(id, organizationId);
    await clientService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "Client",
      entityId: id,
      oldData: old ? { name: old.name, linkCrm: old.linkCrm } : undefined,
    });
    updateTag("clients");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreClient(id: string) {
  const { organizationId } = await requirePermission("clients", "update");
  try {
    await clientService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "Client", entityId: id });
    updateTag("clients");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setClientStatus(id: string, status: boolean) {
  const { organizationId } = await requirePermission("clients", "update");
  try {
    await clientService.setStatus(id, status, organizationId);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: "Client", entityId: id });
    updateTag("clients");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteClients(ids: string[]) {
  const { organizationId, userId } = await requirePermission("clients", "delete");
  try {
    const result = await clientService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Client",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Client", result.blocked, organizationId, userId);
    }
    updateTag("clients");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreClients(ids: string[]) {
  const { organizationId } = await requirePermission("clients", "update");
  try {
    const count = await clientService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Client",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("clients");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
