// Cached reads used by Server Components. Deliberately NOT a "use server" module — see
// queries/admin/clients.ts. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { customFieldService } from "@/services/custom-field.service";
import type { CustomFieldEntity } from "@/lib/custom-fields";
import type { ListParams } from "@/types/common";

export async function listCustomFieldDefinitions(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("custom-field-definitions");
  return customFieldService.list(params, organizationId);
}

export async function listActiveCustomFieldDefinitions(organizationId: string, entity: CustomFieldEntity) {
  "use cache";
  cacheTag("custom-field-definitions");
  return customFieldService.listActive(organizationId, entity);
}
