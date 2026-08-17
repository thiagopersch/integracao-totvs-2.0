"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { clientService } from "@/services/client.service";
import { auditService } from "@/services/audit.service";
import { createClientSchema, updateClientSchema } from "@/schemas/client.schema";
import type { ListParams } from "@/types/common";

export async function listAllClients() {
  "use cache";
  cacheTag("clients");
  return clientService.listAll();
}

export async function listClients(params: ListParams) {
  "use cache";
  cacheTag("clients");
  return clientService.list(params);
}

export async function getClientById(id: string) {
  "use cache";
  cacheTag(`client-${id}`);
  return clientService.getById(id);
}

export async function createClient(formData: FormData) {
  const data = {
    image: formData.get("image") as string,
    name: formData.get("name") as string,
    linkCrm: formData.get("linkCrm") as string,
    site: formData.get("site") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createClientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await clientService.create(parsed.data);
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
  const data = {
    image: formData.get("image") as string,
    name: formData.get("name") as string,
    linkCrm: formData.get("linkCrm") as string,
    site: formData.get("site") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateClientSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await clientService.getById(id);
    const entity = await clientService.update(id, parsed.data);
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
  try {
    const old = await clientService.getById(id);
    await clientService.softDelete(id);
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
  try {
    await clientService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "Client", entityId: id });
    revalidateTag("clients", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteClients(ids: string[]) {
  try {
    const count = await clientService.bulkSoftDelete(ids);
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
  try {
    const count = await clientService.bulkRestore(ids);
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
