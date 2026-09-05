"use server"

import { updateTag, cacheTag } from "next/cache";
import { tbcService } from "@/services/tbc.service";
import { auditService } from "@/services/audit.service";
import { soapService } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { createTbcSchema, updateTbcSchema } from "@/schemas/tbc.schema";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext } from "@/lib/tenant";
import { formatBlockingReferences } from "@/lib/entity-relations";
import type { ListParams } from "@/types/common";
import type { WsName } from "@/lib/ws-names";

export async function listAllTbcs() {
  const { organizationId, allowedClientIds } = await getRequestContext();
  return tbcService.listAll(organizationId, allowedClientIds);
}

export async function listTbcs(params: ListParams, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag("tbcs");
  return tbcService.list(params, organizationId, allowedClientIds);
}

export async function getTbcById(id: string, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`tbc-${id}`);
  return tbcService.getById(id, organizationId, allowedClientIds);
}

export async function testTbcConnection(formData: FormData) {
  const link = formData.get("link") as string;
  const user = formData.get("user") as string;
  const password = formData.get("password") as string;
  const notRequiredLicense = formData.get("notRequiredLicense") === "true";

  try {
    const { organizationId, userId } = await requirePermission("tbcs", "read");
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver");
    await soapService.authenticate(
      { link, user, password, notRequiredLicense },
      dataserverType.suffix as WsName,
      organizationId,
      userId
    );
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function testTbcConnectionById(id: string) {
  try {
    const { organizationId, allowedClientIds, userId } = await requirePermission("tbcs", "read");
    const credentials = await tbcService.getCredentialsForRequest(id, organizationId, allowedClientIds);
    const dataserverType = await soapEndpointService.getActiveTypeByKey("dataserver");
    await soapService.authenticate(credentials, dataserverType.suffix as WsName, organizationId, userId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function createTbc(formData: FormData) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "create");
  const data = {
    clientId: formData.get("clientId") as string,
    name: formData.get("name") as string,
    link: formData.get("link") as string,
    user: formData.get("user") as string,
    password: formData.get("password") as string,
    notRequiredLicense: formData.get("notRequiredLicense") === "true",
    status: formData.get("status") === "true",
  };

  const parsed = createTbcSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await tbcService.create(parsed.data, organizationId, allowedClientIds);
    await auditService.log({
      action: "CREATE",
      entity: "Tbc",
      entityId: entity.id,
      newData: { name: entity.name, link: entity.link },
    });
    updateTag("tbcs");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateTbc(id: string, formData: FormData) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "update");
  const data = {
    clientId: formData.get("clientId") as string,
    name: formData.get("name") as string,
    link: formData.get("link") as string,
    user: formData.get("user") as string,
    password: formData.get("password") as string,
    notRequiredLicense: formData.get("notRequiredLicense") === "true",
    status: formData.get("status") === "true",
  };

  const parsed = updateTbcSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await tbcService.getById(id, organizationId, allowedClientIds);
    if (!old) return { success: false, error: "TBC não encontrado ou fora do seu escopo de acesso" };
    const entity = await tbcService.update(id, parsed.data, organizationId, allowedClientIds);
    await auditService.log({
      action: "UPDATE",
      entity: "Tbc",
      entityId: id,
      oldData: { name: old.name, link: old.link },
      newData: { name: entity.name, link: entity.link },
    });
    updateTag("tbcs");
    updateTag(`tbc-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteTbc(id: string) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "delete");
  try {
    const old = await tbcService.getById(id, organizationId, allowedClientIds);
    if (!old) return { success: false, error: "TBC não encontrado ou fora do seu escopo de acesso" };
    await tbcService.softDelete(id, organizationId, allowedClientIds);
    await auditService.log({
      action: "DELETE",
      entity: "Tbc",
      entityId: id,
      oldData: { name: old.name, link: old.link },
    });
    updateTag("tbcs");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreTbc(id: string) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "update");
  try {
    await tbcService.restore(id, organizationId, allowedClientIds);
    await auditService.log({ action: "RESTORE", entity: "Tbc", entityId: id });
    updateTag("tbcs");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function setTbcStatus(id: string, status: boolean) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "update");
  try {
    await tbcService.setStatus(id, status, organizationId, allowedClientIds);
    await auditService.log({ action: status ? "ACTIVATE" : "DEACTIVATE", entity: "Tbc", entityId: id });
    updateTag("tbcs");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteTbcs(ids: string[]) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("tbcs", "delete");
  try {
    const result = await tbcService.bulkSoftDelete(ids, organizationId, allowedClientIds);
    if (result.deletedIds.length) {
      await auditService.log({
        action: "BULK_DELETE",
        entity: "Tbc",
        entityId: result.deletedIds.join(","),
        organizationId,
        userId,
        newData: { count: result.deletedCount },
      });
    }
    if (result.blocked.length) {
      await auditService.logBulkDeleteBlocked("Tbc", result.blocked, organizationId, userId);
    }
    updateTag("tbcs");
    return {
      success: true,
      deletedCount: result.deletedCount,
      blocked: result.blocked.map((b) => ({ id: b.id, reasons: formatBlockingReferences(b.reasons) })),
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreTbcs(ids: string[]) {
  const { organizationId, allowedClientIds } = await requirePermission("tbcs", "update");
  try {
    const count = await tbcService.bulkRestore(ids, organizationId, allowedClientIds);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "Tbc",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("tbcs");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
