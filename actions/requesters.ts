"use server"

import { updateTag, cacheTag } from "next/cache";
import { requesterService } from "@/services/requester.service";
import { auditService } from "@/services/audit.service";
import { createRequesterSchema, updateRequesterSchema } from "@/schemas/requester.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import type { ListParams } from "@/types/common";

export async function listAllRequesters() {
  const { organizationId } = await getRequestContext();
  return requesterService.listAll(organizationId);
}

export async function listRequesters(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("requesters");
  return requesterService.list(params, organizationId);
}

export async function createRequester(formData: FormData) {
  const { organizationId } = await requirePermission("requesters", "create");
  const data = {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    status: formData.get("status") === "true",
  };

  const parsed = createRequesterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await requesterService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "Requester", entityId: entity.id, newData: { name: entity.name } });
    updateTag("requesters");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRequester(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("requesters", "update");
  const data = {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || "",
    phone: (formData.get("phone") as string) || "",
    status: formData.get("status") === "true",
  };

  const parsed = updateRequesterSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await requesterService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "Requester", entityId: id, newData: { name: entity.name } });
    updateTag("requesters");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteRequester(id: string) {
  const { organizationId } = await requirePermission("requesters", "delete");
  try {
    await requesterService.softDelete(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "Requester", entityId: id });
    updateTag("requesters");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
