"use server"

import { updateTag, cacheTag } from "next/cache";
import { departmentService } from "@/services/department.service";
import { auditService } from "@/services/audit.service";
import { createDepartmentSchema, updateDepartmentSchema } from "@/schemas/department.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listAllDepartments() {
  const { organizationId } = await getRequestContext();
  return departmentService.listAll(organizationId);
}

export async function listDepartments(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("departments");
  return departmentService.list(params, organizationId);
}

export async function createDepartment(formData: FormData) {
  const { organizationId } = await requirePermission("departments", "create");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = createDepartmentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await departmentService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "Department", entityId: entity.id, newData: { name: entity.name } });
    updateTag("departments");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDepartment(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("departments", "update");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = updateDepartmentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await departmentService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "Department", entityId: id, newData: { name: entity.name } });
    updateTag("departments");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDepartment(id: string) {
  const { organizationId } = await requirePermission("departments", "delete");
  try {
    await departmentService.softDelete(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "Department", entityId: id });
    updateTag("departments");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteDepartments(ids: string[]) {
  const { organizationId, userId } = await requirePermission("departments", "delete");
  try {
    const result = await departmentService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Department",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Department", result.blocked, organizationId, userId);
    }
    updateTag("departments");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
