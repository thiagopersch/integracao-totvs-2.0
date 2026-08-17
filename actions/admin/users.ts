"use server"

import { revalidateTag, cacheTag } from "next/cache";
import { userService } from "@/services/user.service";
import { auditService } from "@/services/audit.service";
import { createUserSchema, updateUserSchema } from "@/schemas/user.schema";
import type { ListParams } from "@/types/common";

export async function listUsers(params: ListParams) {
  "use cache";
  cacheTag("users");
  return userService.list(params);
}

export async function getUserById(id: string) {
  "use cache";
  cacheTag(`user-${id}`);
  return userService.getById(id);
}

export async function createUser(formData: FormData) {
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    password: formData.get("password") as string,
    role: formData.get("role") as string,
    status: formData.get("status") === "true",
  };

  const parsed = createUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const user = await userService.create(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "User",
      entityId: user.id,
      newData: { name: user.name, email: user.email, role: user.role },
    });
    revalidateTag("users", "max");
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateUser(id: string, formData: FormData) {
  const data = {
    name: formData.get("name") as string,
    email: formData.get("email") as string,
    role: formData.get("role") as string,
    status: formData.get("status") === "true",
  };

  const parsed = updateUserSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const oldUser = await userService.getById(id);
    const user = await userService.update(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "User",
      entityId: id,
      oldData: oldUser ? { name: oldUser.name, email: oldUser.email, role: oldUser.role } : undefined,
      newData: { name: user.name, email: user.email, role: user.role },
    });
    revalidateTag("users", "max");
    revalidateTag(`user-${id}`, "max");
    return { success: true, data: user };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteUser(id: string) {
  try {
    const oldUser = await userService.getById(id);
    await userService.softDelete(id);
    await auditService.log({
      action: "DELETE",
      entity: "User",
      entityId: id,
      oldData: oldUser ? { name: oldUser.name, email: oldUser.email } : undefined,
    });
    revalidateTag("users", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreUser(id: string) {
  try {
    await userService.restore(id);
    await auditService.log({ action: "RESTORE", entity: "User", entityId: id });
    revalidateTag("users", "max");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteUsers(ids: string[]) {
  try {
    const count = await userService.bulkSoftDelete(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "User",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("users", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreUsers(ids: string[]) {
  try {
    const count = await userService.bulkRestore(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "User",
      entityId: ids.join(","),
      newData: { count },
    });
    revalidateTag("users", "max");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
