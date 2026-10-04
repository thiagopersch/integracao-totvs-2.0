// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { analystService } from "@/services/analyst.service";
import type { ListParams } from "@/types/common";

export async function listAnalysts(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("analysts");
  return analystService.list(params, organizationId);
}

