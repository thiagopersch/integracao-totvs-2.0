"use server"

import { updateTag } from "next/cache";
import { customFieldService } from "@/services/custom-field.service";
import { auditService } from "@/services/audit.service";
import { customFieldDefinitionSchema, reorderCustomFieldsSchema } from "@/schemas/custom-field.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";

const ENTITY = "CustomFieldDefinition";

function invalidate() {
  updateTag("custom-field-definitions");
  // Project list columns/filters and forms read the active definitions.
  updateTag("projects");
}

export async function createCustomFieldDefinition(input: unknown) {
  const { organizationId } = await requirePermission("project_custom_fields", "create");
  const parsed = customFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const entity = await customFieldService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: ENTITY, entityId: entity.id, newData: { name: entity.label, type: entity.type } });
    invalidate();
    return { success: true, data: { id: entity.id } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateCustomFieldDefinition(id: string, input: unknown) {
  const { organizationId } = await requirePermission("project_custom_fields", "update");
  const parsed = customFieldDefinitionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }
  try {
    const old = await customFieldService.getById(id, organizationId);
    const entity = await customFieldService.update(id, parsed.data, organizationId);
    await auditService.log({
      action: "UPDATE",
      entity: ENTITY,
      entityId: id,
      oldData: old ? { name: old.label, type: old.type, required: old.required } : undefined,
      newData: { name: entity.label, type: entity.type, required: entity.required },
    });
    invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteCustomFieldDefinition(id: string) {
  const { organizationId } = await requirePermission("project_custom_fields", "delete");
  try {
    const old = await customFieldService.softDelete(id, organizationId);
    await auditService.log({ action: "DELETE", entity: ENTITY, entityId: id, oldData: { name: old.label } });
    invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreCustomFieldDefinition(id: string) {
  const { organizationId } = await requirePermission("project_custom_fields", "update");
  try {
    await customFieldService.restore(id, organizationId);
    await auditService.log({ action: "RESTORE", entity: ENTITY, entityId: id });
    invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setCustomFieldDefinitionStatus(id: string, status: boolean) {
  const { organizationId } = await requirePermission("project_custom_fields", "update");
  try {
    await customFieldService.setStatus(id, status, organizationId);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: ENTITY, entityId: id });
    invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteCustomFieldDefinitions(ids: string[]) {
  const { organizationId, userId } = await requirePermission("project_custom_fields", "delete");
  try {
    const result = await customFieldService.bulkSoftDelete(ids, organizationId);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: ENTITY,
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked(ENTITY, result.blocked, organizationId, userId);
    }
    invalidate();
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreCustomFieldDefinitions(ids: string[]) {
  const { organizationId } = await requirePermission("project_custom_fields", "update");
  try {
    const count = await customFieldService.bulkRestore(ids, organizationId);
    await auditService.log({ action: "BULK_RESTORE", entity: ENTITY, entityId: ids.join(","), newData: { count } });
    invalidate();
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function reorderCustomFieldDefinitions(input: unknown) {
  const { organizationId } = await requirePermission("project_custom_fields", "update");
  const parsed = reorderCustomFieldsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Dados inválidos" };
  try {
    await customFieldService.reorder(parsed.data.entity, parsed.data.ids, organizationId);
    await auditService.log({ action: "UPDATE", entity: ENTITY, entityId: parsed.data.ids.join(","), notify: false, newData: { reordered: parsed.data.entity } });
    invalidate();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
