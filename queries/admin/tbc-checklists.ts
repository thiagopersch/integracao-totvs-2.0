// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { tbcChecklistService } from "@/services/tbc-checklist.service";

export async function listTbcChecklists(tbcId: string, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`tbc-checklists-${tbcId}`);
  return tbcChecklistService.listByTbc(tbcId, organizationId, allowedClientIds);
}
