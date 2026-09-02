"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";
import { getRequestContext } from "@/lib/tenant";
import { periodToDateRange, type Period } from "@/lib/period";

export async function getDashboardStats(period?: Period | null) {
  const { organizationId, allowedClientIds } = await getRequestContext();
  return getCachedDashboardStats(organizationId, allowedClientIds, period ?? null);
}

async function getCachedDashboardStats(organizationId: string, allowedClientIds: string[], period: Period | null) {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats(organizationId, allowedClientIds, periodToDateRange(period));
}
