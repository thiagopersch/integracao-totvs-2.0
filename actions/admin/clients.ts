"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { clientService } from "@/services/client.service";
import { auditService } from "@/services/audit.service";
import { createClientSchema, updateClientSchema } from "@/schemas/client.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import type { ListParams } from "@/types/common";

export async function listAllClients() {
  const { organizationId } = await getRequestContext();
  return clientService.listAll(organizationId);
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

function parseClientForm(formData: FormData) {
  return {
    image: (formData.get("image") as string) || undefined,
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
  const parsed = createClientSchema.safeParse(parseClientForm(formData));
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
    revalidateTag("clients", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateClient(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("clients", "update");
  const parsed = updateClientSchema.safeParse(parseClientForm(formData));
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
    revalidateTag("clients", "max");
    revalidateTag(`client-${id}`, "max");
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
    revalidateTag("clients", "max");
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
    revalidateTag("clients", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteClients(ids: string[]) {
  const { organizationId } = await requirePermission("clients", "delete");
  try {
    const count = await clientService.bulkSoftDelete(ids, organizationId);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "Client",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("clients", "max");
    return { success: true, count };
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
    revalidateTag("clients", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
