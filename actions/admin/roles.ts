"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { roleService } from "@/services/role.service";
import { auditService } from "@/services/audit.service";
import { createRoleSchema, updateRoleSchema } from "@/schemas/role.schema";
import { requirePermission } from "@/lib/rbac";

export async function listRoles(organizationId: string) {
  "use cache";
  cacheTag("roles");
  return roleService.list(organizationId);
}

export async function listAllPermissions() {
  "use cache";
  cacheTag("permissions");
  return roleService.listAllPermissions();
}

export async function createRole(formData: FormData) {
  const { organizationId } = await requirePermission("roles", "create");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    permissionIds: formData.getAll("permissionIds") as string[],
  };

  const parsed = createRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await roleService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "Role", entityId: entity.id, newData: { name: entity.name } });
    revalidateTag("roles", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRole(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("roles", "update");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    permissionIds: formData.getAll("permissionIds") as string[],
  };

  const parsed = updateRoleSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await roleService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "Role", entityId: id, newData: { name: entity.name } });
    revalidateTag("roles", "max");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteRole(id: string) {
  const { organizationId } = await requirePermission("roles", "delete");
  try {
    await roleService.remove(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "Role", entityId: id });
    revalidateTag("roles", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
