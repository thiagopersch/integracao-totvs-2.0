"use server";

import { activityLogService, type ActivityFilters } from "@/services/activity-log.service";
import { requirePermission } from "@/lib/rbac";

export async function listActivityLog(
  page = 1,
  pageSize = 20,
  filters?: ActivityFilters,
  sort?: { field: "createdAt"; direction: "asc" | "desc" }
) {
  const { organizationId } = await requirePermission("activity_logs", "read");
  return activityLogService.list(organizationId, page, pageSize, filters, sort);
}

export async function listActivityTipoOptions() {
  const { organizationId } = await requirePermission("activity_logs", "read");
  return activityLogService.listTipoOptions(organizationId);
}

export async function listActivityApiMethods() {
  const { organizationId } = await requirePermission("activity_logs", "read");
  return activityLogService.listDistinctApiMethods(organizationId);
}

export async function listActivityStatusCodes() {
  const { organizationId } = await requirePermission("activity_logs", "read");
  return activityLogService.listStatusCodes(organizationId);
}
