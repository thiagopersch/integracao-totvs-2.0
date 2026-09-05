"use server"

import { updateTag, cacheTag } from "next/cache";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { auditService } from "@/services/audit.service";
import {
  createSoapEndpointTypeSchema,
  updateSoapEndpointTypeSchema,
  createSoapEndpointMethodSchema,
  updateSoapEndpointMethodSchema,
} from "@/schemas/soap-endpoint.schema";
import type { ListParams } from "@/types/common";

export async function listSoapEndpointTypes(params: ListParams) {
  "use cache";
  cacheTag("soap-endpoint-types");
  return soapEndpointService.listTypes(params);
}

export async function listAllSoapEndpointTypes() {
  "use cache";
  cacheTag("soap-endpoint-types");
  return soapEndpointService.listAllTypes();
}

export async function listSoapEndpointFilterOptions() {
  "use cache";
  cacheTag("soap-endpoint-types");
  return soapEndpointService.listDistinctFilters();
}

export async function getSoapEndpointTypeById(id: string) {
  "use cache";
  cacheTag(`soap-endpoint-type-${id}`);
  return soapEndpointService.getTypeById(id);
}

export async function createSoapEndpointType(formData: FormData) {
  const data = {
    type: formData.get("type") as string,
    label: formData.get("label") as string,
    suffix: formData.get("suffix") as string,
    active: formData.get("active") === "true",
  };

  const parsed = createSoapEndpointTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await soapEndpointService.createType(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "SoapEndpointType",
      entityId: entity.id,
      newData: { type: entity.type, label: entity.label },
    });
    updateTag("soap-endpoint-types");
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSoapEndpointType(id: string, formData: FormData) {
  const data = {
    type: formData.get("type") as string,
    label: formData.get("label") as string,
    suffix: formData.get("suffix") as string,
    active: formData.get("active") === "true",
  };

  const parsed = updateSoapEndpointTypeSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await soapEndpointService.getTypeById(id);
    const entity = await soapEndpointService.updateType(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "SoapEndpointType",
      entityId: id,
      oldData: old ? { type: old.type, label: old.label } : undefined,
      newData: { type: entity.type, label: entity.label },
    });
    updateTag("soap-endpoint-types");
    updateTag(`soap-endpoint-type-${id}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSoapEndpointType(id: string) {
  try {
    const old = await soapEndpointService.getTypeById(id);
    await soapEndpointService.softDeleteType(id);
    await auditService.log({
      action: "DELETE",
      entity: "SoapEndpointType",
      entityId: id,
      oldData: old ? { type: old.type, label: old.label } : undefined,
    });
    updateTag("soap-endpoint-types");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSoapEndpointType(id: string) {
  try {
    await soapEndpointService.restoreType(id);
    await auditService.log({ action: "RESTORE", entity: "SoapEndpointType", entityId: id });
    updateTag("soap-endpoint-types");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkDeleteSoapEndpointTypes(ids: string[]) {
  try {
    const count = await soapEndpointService.bulkSoftDeleteTypes(ids);
    await auditService.log({
      action: "BULK_DELETE",
      entity: "SoapEndpointType",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("soap-endpoint-types");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function bulkRestoreSoapEndpointTypes(ids: string[]) {
  try {
    const count = await soapEndpointService.bulkRestoreTypes(ids);
    await auditService.log({
      action: "BULK_RESTORE",
      entity: "SoapEndpointType",
      entityId: ids.join(","),
      newData: { count },
    });
    updateTag("soap-endpoint-types");
    return { success: true, count };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listSoapEndpointMethods(endpointTypeId: string, params: ListParams) {
  "use cache";
  cacheTag(`soap-endpoint-methods-${endpointTypeId}`);
  return soapEndpointService.listMethods(endpointTypeId, params);
}

export async function createSoapEndpointMethod(formData: FormData) {
  const data = {
    endpointTypeId: formData.get("endpointTypeId") as string,
    method: formData.get("method") as string,
    label: formData.get("label") as string,
    sortOrder: Number(formData.get("sortOrder")) || 0,
    active: formData.get("active") === "true",
  };

  const parsed = createSoapEndpointMethodSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const entity = await soapEndpointService.createMethod(parsed.data);
    await auditService.log({
      action: "CREATE",
      entity: "SoapEndpointMethod",
      entityId: entity.id,
      newData: { method: entity.method, label: entity.label },
    });
    updateTag("soap-endpoint-types");
    updateTag(`soap-endpoint-methods-${data.endpointTypeId}`);
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateSoapEndpointMethod(id: string, formData: FormData) {
  const data = {
    endpointTypeId: formData.get("endpointTypeId") as string,
    method: formData.get("method") as string,
    label: formData.get("label") as string,
    sortOrder: Number(formData.get("sortOrder")) || 0,
    active: formData.get("active") === "true",
  };

  const parsed = updateSoapEndpointMethodSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: "Dados inválidos", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const old = await soapEndpointService.getMethodById(id);
    const entity = await soapEndpointService.updateMethod(id, parsed.data);
    await auditService.log({
      action: "UPDATE",
      entity: "SoapEndpointMethod",
      entityId: id,
      oldData: old ? { method: old.method, label: old.label } : undefined,
      newData: { method: entity.method, label: entity.label },
    });
    updateTag("soap-endpoint-types");
    if (old) {
      updateTag(`soap-endpoint-methods-${old.endpointTypeId}`);
    }
    return { success: true, data: entity };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSoapEndpointMethod(id: string) {
  try {
    const old = await soapEndpointService.getMethodById(id);
    await soapEndpointService.softDeleteMethod(id);
    await auditService.log({
      action: "DELETE",
      entity: "SoapEndpointMethod",
      entityId: id,
      oldData: old ? { method: old.method, label: old.label } : undefined,
    });
    updateTag("soap-endpoint-types");
    if (old) {
      updateTag(`soap-endpoint-methods-${old.endpointTypeId}`);
    }
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function restoreSoapEndpointMethod(id: string) {
  try {
    await soapEndpointService.restoreMethod(id);
    await auditService.log({ action: "RESTORE", entity: "SoapEndpointMethod", entityId: id });
    updateTag("soap-endpoint-types");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
