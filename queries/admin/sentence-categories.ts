// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { sentenceCategoryService } from "@/services/sentence-category.service";
import type { ListParams } from "@/types/common";

export async function listSentenceCategories(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("sentenceCategories");
  return sentenceCategoryService.list(params, organizationId);
}

export async function getSentenceCategoryById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`sentenceCategory-${id}`);
  return sentenceCategoryService.getById(id, organizationId);
}
