"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";
import { getRequestContext } from "@/lib/tenant";
import { periodToDateRange, type Period } from "@/lib/period";
import { monthForPeriod } from "@/lib/contract-usage";

export async function getDashboardStats(period?: Period | null) {
  const { organizationId, allowedClientIds } = await getRequestContext();
  // Resolved outside the cache so "current month" (year-only/no period) is part of the cache key.
  const attentionMonth = monthForPeriod(period ?? null);
  return getCachedDashboardStats(organizationId, allowedClientIds, period ?? null, attentionMonth);
}

async function getCachedDashboardStats(
  organizationId: string,
  allowedClientIds: string[],
  period: Period | null,
  attentionMonth: { year: number; month: number }
) {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats(organizationId, allowedClientIds, periodToDateRange(period), attentionMonth);
}
