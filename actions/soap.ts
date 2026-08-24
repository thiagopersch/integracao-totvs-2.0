"use server"

import { soapService } from "@/services/soap.service";
import { getRequestContext } from "@/lib/tenant";

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
    await soapService.deleteFavorite(id, userId, organizationId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSoapTemplate(id: string) {
  const { organizationId } = await getRequestContext();
  try {
    await soapService.deleteTemplate(id, organizationId);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
