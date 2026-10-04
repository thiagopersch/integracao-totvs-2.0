// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { filterService } from "@/services/filter.service";
import type { ListParams } from "@/types/common";

export async function listFilters(params: ListParams, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag("filters");
  return filterService.list(params, organizationId, allowedClientIds);
}

export async function getFilterById(id: string, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getById(id, organizationId, allowedClientIds);
}

export async function getFilterByIdWithRelations(id: string, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`filter-${id}`);
  return filterService.getByIdWithRelations(id, organizationId, allowedClientIds);
}
