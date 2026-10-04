// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { userService } from "@/services/user.service";
import type { ListParams } from "@/types/common";

export async function listUsers(params: ListParams, organizationId: string) {
  "use cache";
  cacheTag("users");
  const result = await userService.list(params, organizationId);
  const allowedClientsByUser = await userService.getAllowedClientsForUsers(result.data.map((u) => u.id));
  return {
    ...result,
    data: result.data.map((u) => ({ ...u, allowedClients: allowedClientsByUser[u.id] ?? [] })),
  };
}

export async function getUserById(id: string, organizationId: string) {
  "use cache";
  cacheTag(`user-${id}`);
  return userService.getById(id, organizationId);
}

export async function getUserClientIds(userId: string) {
  "use cache";
  cacheTag(`user-clients-${userId}`);
  return userService.getAllowedClientIds(userId);
}
