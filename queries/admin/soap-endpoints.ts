// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { soapEndpointService } from "@/services/soap-endpoint.service";
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

export async function listSoapEndpointMethods(endpointTypeId: string, params: ListParams) {
  "use cache";
  cacheTag(`soap-endpoint-methods-${endpointTypeId}`);
  return soapEndpointService.listMethods(endpointTypeId, params);
}
