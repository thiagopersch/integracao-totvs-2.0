"use server"

import { updateTag, cacheTag } from "next/cache";
import { demandTypeService } from "@/services/demand-type.service";
import { auditService } from "@/services/audit.service";
import { createDemandTypeSchema, updateDemandTypeSchema } from "@/schemas/demand-type.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import type { ListParams } from "@/types/common";

export async function listAllDemandTypes() {
  const { organizationId } = await getRequestContext();
  return demandTypeService.listAll(organizationId);
}

export async function listDemandTypes(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("demandTypes");
  return demandTypeService.list(params, organizationId);
}

export async function createDemandType(formData: FormData) {
  const { organizationId } = await requirePermission("demand_types", "create");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    color: (formData.get("color") as string) || "#a855f7",
  };

  const parsed = createDemandTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await demandTypeService.create(parsed.data, organizationId);
    await auditService.log({ action: "CREATE", entity: "DemandType", entityId: entity.id, newData: { name: entity.name } });
    updateTag("demandTypes");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateDemandType(id: string, formData: FormData) {
  const { organizationId } = await requirePermission("demand_types", "update");
  const data = {
    name: formData.get("name") as string,
    description: (formData.get("description") as string) || undefined,
    color: (formData.get("color") as string) || undefined,
  };

  const parsed = updateDemandTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await demandTypeService.update(id, parsed.data, organizationId);
    await auditService.log({ action: "UPDATE", entity: "DemandType", entityId: id, newData: { name: entity.name } });
    updateTag("demandTypes");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteDemandType(id: string) {
  const { organizationId } = await requirePermission("demand_types", "delete");
  try {
    await demandTypeService.softDelete(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "DemandType", entityId: id });
    updateTag("demandTypes");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
