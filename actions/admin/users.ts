"use server"

import { updateTag, cacheTag } from "next/cache";
import { userService } from "@/services/user.service";
import { auditService } from "@/services/audit.service";
import { createUserSchema, updateUserSchema } from "@/schemas/user.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";
import { generateTemporaryPassword } from "@/lib/password-generator";
import type { ListParams } from "@/types/common";

export async function listUsers(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("users");
  const result = await userService.list(params, organizationId);
  const allowedClientsByUser = await userService.getAllowedClientsForUsers(result.data.map((u) => u.id));
  return {
    ...result,
    data: result.data.map((u) => ({ ...u, allowedClients: allowedClientsByUser[u.id] ?? [] })),
  };
}

export async function getUserById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`user-${id}`);
  return userService.getById(id, organizationId);
}

export async function getUserClientIds(userId: string) {
  "use cache";
  cacheTag(`user-clients-${userId}`);
  return userService.getAllowedClientIds(userId);
}

export async function setUserClients(userId: string, clientIds: string[]) {
  const { organizationId } = await requirePermission("users", "update");
  try {
    const validIds = await userService.setAllowedClients(userId, clientIds, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "UserClient",
      entityId: userId,
      newData: { clientIds: validIds },
    });
    updateTag("users");
    updateTag(`user-clients-${userId}`);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createUser(formData: FormData) {
  const { organizationId } = await requirePermission("users", "create");
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    role: formData.get("role") as string,
    status: formData.get("status") === "true",
    changePassword: formData.get("changePassword") === "true",
  };

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await userService.create(parsed.data, organizationId);
    await auditService.log({
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      newData: { name: user.name, email: user.email, role: user.role },
    });
    updateTag("users");
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateUser(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("users", "update");
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    status: formData.get("status") === "true",
    changePassword: formData.get("changePassword") === "true",
  };

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const oldUser = await userService.getById(id, organizationId);
    const user = await userService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: "User",
      entityId: id,
      oldData: oldUser ? { name: oldUser.name, email: oldUser.email, role: oldUser.role } : undefined,
      newData: { name: user.name, email: user.email, role: user.role },
    });
    updateTag("users");
    updateTag(`user-${id}`);
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteUser(id: string) {
  const { organizationId } = await requirePermission("users", "delete");
  try {
    const oldUser = await userService.getById(id, organizationId);
    await userService.softDelete(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "User",
      entityId: id,
      oldData: oldUser ? { name: oldUser.name, email: oldUser.email } : undefined,
    });
    updateTag("users");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreUser(id: string) {
  const { organizationId } = await requirePermission("users", "update");
  try {
    await userService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: "User", entityId: id });
    updateTag("users");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setUserStatus(id: string, status: boolean) {
  const { organizationId } = await requirePermission("users", "update");
  try {
    await userService.setStatus(id, status, organizationId);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: "User", entityId: id });
    updateTag("users");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteUsers(ids: string[]) {
  const { organizationId, userId } = await requirePermission("users", "delete");
  try {
    const result = await userService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "User",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("User", result.blocked, organizationId, userId);
    }
    updateTag("users");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function resetUserPassword(id: string) {
  const { organizationId } = await requirePermission("users", "update");
  try {
    const temporaryPassword = generateTemporaryPassword();
    await userService.resetPassword(id, temporaryPassword, organizationId);
    await auditService.log({ action: "RESET_PASSWORD", entity: "User", entityId: id });
    updateTag("users");
    updateTag(`user-${id}`);
    return { success: true, temporaryPassword };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreUsers(ids: string[]) {
  const { organizationId } = await requirePermission("users", "update");
  try {
    const count = await userService.bulkRestore(ids, organizationId);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "User",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("users");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
