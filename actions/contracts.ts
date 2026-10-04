"use server"

import { updateTag } from "next/cache";
import { contractService } from "@/services/contract.service";
import { contractUsageService } from "@/services/contract-usage.service";
import { currentMonth } from "@/lib/contract-usage";
import { auditService } from "@/services/audit.service";
import { createContractSchema, updateContractSchema } from "@/schemas/contract.schema";
import { requirePermission } from "@/lib/rbac";
import { formatBlockingReferences } from "@/lib/entity-relations";
function parseContractForm(formData: FormData) {
  return {
    clientId: formData.get("clientId") as string,
    contractedHours: formData.get("contractedHours") ? Number(formData.get("contractedHours")) : undefined,
    startDate: formData.get("startDate") as string,
    endDate: (formData.get("endDate") as string) ?? "",
    status: (formData.get("status") as string) || "ACTIVE",
    notifyClient: formData.get("notifyClient") === "true",
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
    // Contracted hours changed: the current month's consumption may now cross a threshold.
    contractUsageService.scheduleCheck(organizationId, [{ clientId: entity.clientId, date: new Date(), trigger: "contract" }]);
    updateTag("contracts");
    updateTag("dashboard");
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
    contractUsageService.scheduleCheck(organizationId, [{ clientId: entity.clientId, date: new Date(), trigger: "contract" }]);
    updateTag("contracts");
    updateTag("dashboard");
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

/**
 * "Reenviar notificação de consumo": sends the consumption email of `month` (default: current) for the
 * contract's client right now, whatever the percentage (same recipients/template as the automatic
 * alert). Runs synchronously so the toast can report what actually happened.
 */
export async function resendContractUsageNotification(contractId: string, month?: { year: number; month: number }) {
  const { organizationId, allowedClientIds } = await requirePermission("contracts", "update");
  const contract = await contractService.getById(contractId, organizationId, allowedClientIds);
  if (!contract) return { success: false, error: "Contrato não encontrado" };

  try {
    const validMonth = month && Number.isInteger(month.year) && month.month >= 1 && month.month <= 12 ? month : undefined;
    const result = await contractUsageService.checkAndNotify(organizationId, contract.clientId, validMonth ?? currentMonth(), "manual");
    await auditService.log({
      action: "UPDATE",
      entity: "ClientContract",
      entityId: contractId,
      newData: { name: `Reenvio da notificação de consumo — ${contract.client.name}`, status: result.status, to: result.to },
    });
    switch (result.status) {
      case "SENT":
        return { success: true, message: `Notificação enviada para ${result.to}${result.cc?.length ? ` (cc: ${result.cc.join(", ")})` : ""}` };
      case "SKIPPED":
        return { success: false, error: "Envio de e-mail desativado — configure o SMTP em Integrações > E-mail." };
      case "FAILED":
        return { success: false, error: "Falha ao enviar o e-mail — veja o registro em Atividades." };
      case "NO_RECIPIENT":
        return {
          success: false,
          error: "Nenhum destinatário: cadastre o e-mail do cliente (com \"Notificar cliente\" ativo) ou o e-mail de alertas em Integrações > E-mail.",
        };
      case "NO_CONTRACT":
        return { success: false, error: "O cliente não tem contrato vigente neste mês." };
      default:
        return { success: false, error: "Nada a enviar." };
    }
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
