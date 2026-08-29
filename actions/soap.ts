"use server"

import { updateTag } from "next/cache";
import { soapService, type WsName } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { tbcService } from "@/services/tbc.service";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { auditService } from "@/services/audit.service";
import type { SoapContext } from "@/types/soap";
import type { SoapMethod } from "@prisma/client";

export async function listSoapFavorites() {
  const { organizationId, userId } = await getRequestContext();
  return soapService.getFavorites(userId, organizationId);
}

export async function listSoapTemplates() {
  const { organizationId, userId } = await getRequestContext();
  return soapService.getTemplates(organizationId, userId);
}

export async function deleteSoapFavorite(id: string) {
  const { organizationId, userId } = await getRequestContext();
  try {
    const favorite = await prisma.soapFavorite.findFirst({ where: { id, userId, organizationId } });
    await soapService.deleteFavorite(id, userId, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "SoapFavorite",
      entityId: id,
      organizationId,
      userId,
      oldData: favorite ? { name: favorite.name, dataserver: favorite.dataserver, process: favorite.process, method: favorite.method } : undefined,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSoapTemplate(id: string) {
  const { organizationId } = await getRequestContext();
  try {
    const template = await prisma.soapTemplate.findFirst({ where: { id, organizationId } });
    await soapService.deleteTemplate(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "SoapTemplate",
      entityId: id,
      organizationId,
      oldData: template ? { name: template.name, dataserver: template.dataserver, process: template.process, method: template.method } : undefined,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Reruns a SOAP History entry exactly as it was sent. A log only stores the TBC's link/wsName —
 * not their ids — so this recovers the TBC by link and the endpoint type by its ws folder
 * (SoapLog.process), then resolves the method from /admin/soap-endpoints like every other call.
 */
export async function reexecuteSoapLog(logId: string) {
  const { organizationId, userId } = await requirePermission("soap", "execute");
  try {
    const log = await prisma.soapLog.findFirst({ where: { id: logId, organizationId } });
    if (!log) return { success: false, error: "Registro de histórico não encontrado" };
    if (!log.dataserver || !log.process || !log.method || !log.xmlRequest) {
      return { success: false, error: "Este registro não tem dados suficientes para ser reexecutado" };
    }

    const tbcRow = await prisma.tbc.findFirst({ where: { link: log.dataserver, organizationId, deletedAt: null } });
    if (!tbcRow) return { success: false, error: `Nenhum TBC cadastrado com o link "${log.dataserver}"` };

    const tbc = await tbcService.getCredentialsForRequest(tbcRow.id, organizationId);
    const endpointType = await soapEndpointService.getActiveTypeBySuffix(log.process);
    const endpointMethod = await soapEndpointService.getActiveMethodByKey(endpointType.id, log.method);

    const result = await soapService.execute(
      {
        tbc,
        wsName: endpointType.suffix as WsName,
        method: endpointMethod.method as SoapMethod,
        xml: log.xmlRequest,
        context: (log.context as SoapContext | null) ?? undefined,
      },
      organizationId,
      userId
    );

    updateTag("dashboard");
    return { success: true, data: result };
  } catch (error) {
    // soapService.execute logs the SoapLog row even on failure, so the dashboard's
    // recent-executions box needs invalidating here too, not just on the success path.
    updateTag("dashboard");
    return { success: false, error: (error as Error).message };
  }
}
