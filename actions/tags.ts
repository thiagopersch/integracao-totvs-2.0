"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { tagService } from "@/services/tag.service";
import { auditService } from "@/services/audit.service";
import { createTagSchema, updateTagSchema } from "@/schemas/tag.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";

export async function listAllTags() {
  const { organizationId } = await getRequestContext();
  return tagService.listAll(organizationId);
}

export async function listTags(search?: string) {
  "use cache";
  cacheTag("tags");
  const { organizationId } = await getRequestContext();
  return tagService.list(organizationId, search);
}

export async function createTag(formData: FormData) {
  const { organizationId } = await requirePermission("tags", "create");
  const data = {
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || "#8b5cf6",
  };

  const parsed = createTagSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await tagService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "Tag", entityId: entity.id, newData: { name: entity.name } });
    revalidateTag("tags", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTag(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("tags", "update");
  const data = {
    name: formData.get("name") as string,
    color: (formData.get("color") as string) || undefined,
  };

  const parsed = updateTagSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await tagService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "Tag", entityId: id, newData: { name: entity.name } });
    revalidateTag("tags", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTag(id: string) {
  const { organizationId } = await requirePermission("tags", "delete");
  try {
    await tagService.remove(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "Tag", entityId: id });
    revalidateTag("tags", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
