// Cached reads of the TOTVS data dictionary. Deliberately NOT a "use server" module — callers
// check the permission first. Tag "totvs-dictionary" is shared with queries/sql-docs.ts.

import { cacheTag } from "next/cache";
import { totvsDictionaryService } from "@/services/totvs-dictionary.service";
import type { ListParams } from "@/types/common";

export async function listTotvsDictionary(params: ListParams) {
  "use cache";
  cacheTag("totvs-dictionary");
  return totvsDictionaryService.list(params);
}
