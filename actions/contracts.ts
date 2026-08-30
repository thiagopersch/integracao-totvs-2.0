"use server"

import { updateTag, cacheTag } from "next/cache";
import { contractService } from "@/services/contract.service";
import { auditService } from "@/services/audit.service";
import { createContractSchema, updateContractSchema } from "@/schemas/contract.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";

export async function listContracts(params: ListParams, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag("contracts");
  return contractService.list(params, organizationId, allowedClientIds);
}

function parseContractForm(formData: FormData) {
  return {
    clientId: formData.get("clientId") as string,
    contractedHours: formData.get("contractedHours") ? Number(formData.get("contractedHours")) : undefined,
    startDate: formData.get("startDate") as string,
    endDate: (formData.get("endDate") as string) || undefined,
    status: (formData.get("status") as string) || "ACTIVE",
    notes: (formData.get("notes") as string) || undefined,
  };
}

export async function createContract(formData: FormData) {
  const { organizationId, allowedClientIds } = await requirePermission("contracts", "create");
  const parsed = createContractSchema.safeParse(parseContractForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await contractService.create(parsed.data, organizationId, allowedClientIds);
    await auditService.log({ action: "CREATE", entity: "ClientContract", entityId: entity.id, newData: { clientId: entity.clientId } });
    updateTag("contracts");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateContract(id: string, formData: FormData) {
  const { organizationId, allowedClientIds } = await requirePermission("contracts", "update");
  const parsed = updateContractSchema.safeParse(parseContractForm(formData));
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await contractService.update(id, parsed.data, organizationId, allowedClientIds);
    await auditService.log({ action: "UPDATE", entity: "ClientContract", entityId: id, newData: { clientId: entity.clientId } });
    updateTag("contracts");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteContract(id: string) {
  const { organizationId, allowedClientIds } = await requirePermission("contracts", "delete");
  try {
    await contractService.delete(id, organizationId, allowedClientIds);
    await auditService.log({ action: "DELETE", entity: "ClientContract", entityId: id });
    updateTag("contracts");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteContracts(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("contracts", "delete");
  try {
    const result = await contractService.bulkDelete(ids, organizationId, allowedClientIds);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "ClientContract",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("ClientContract", result.blocked, organizationId, userId);
    }
    updateTag("contracts");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
