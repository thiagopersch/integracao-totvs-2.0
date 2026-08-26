"use server";

import { auditService } from "@/services/audit.service";
import { requirePermission } from "@/lib/rbac";

export async function listDeletionErrors(page = 1, pageSize = 20) {
  const { organizationId } = await requirePermission("deletion_logs", "read");
  return auditService.listBulkDeleteBlocked(organizationId, page, pageSize);
}
