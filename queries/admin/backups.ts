// Cached reads used by Server Components. Deliberately NOT a "use server" module: every export of a
// "use server" file is a public POST endpoint, and these take organizationId/allowedClientIds as
// trusted arguments (a requirement of "use cache", which can't read the session) — exposing them
// would let a caller read another tenant's data. Callers resolve the request context first.

import { cacheTag } from "next/cache";
import { backupService } from "@/services/backup.service";
import { filterService } from "@/services/filter.service";
import type { ListParams } from "@/types/common";

export async function listLatestBackupsForFilter(filterId: string, params: ListParams, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`filter-backups-${filterId}`);
  const filter = await filterService.getById(filterId, organizationId, allowedClientIds);
  if (!filter) return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };
  return backupService.listLatestByFilter(filterId, params, organizationId);
}

export async function listBackupRunsForFilter(filterId: string, params: ListParams, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`filter-backup-runs-${filterId}`);
  const filter = await filterService.getById(filterId, organizationId, allowedClientIds);
  if (!filter) return { data: [], meta: { page: 1, pageSize: 10, total: 0, totalPages: 0 } };
  return backupService.listRunsByFilter(filterId, params, organizationId);
}
