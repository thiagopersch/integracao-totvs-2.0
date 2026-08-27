"use server";

import { activityLogService, type ActivitySource } from "@/services/activity-log.service";
import { requirePermission } from "@/lib/rbac";

export async function listActivityLog(
  page = 1,
  pageSize = 20,
  filters?: { source?: ActivitySource; dateFrom?: Date; dateTo?: Date; search?: string }
) {
  const { organizationId } = await requirePermission("activity_logs", "read");
  return activityLogService.list(organizationId, page, pageSize, filters);
}
