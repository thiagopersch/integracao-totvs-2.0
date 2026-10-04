"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";
import { getRequestContext } from "@/lib/tenant";
import { periodToDateRange, type Period } from "@/lib/period";
import { monthForPeriod } from "@/lib/contract-usage";
import { prisma } from "@/lib/prisma";

export async function getDashboardStats(period?: Period | null) {
  const { organizationId, allowedClientIds, userId } = await getRequestContext();
  // Resolved outside the cache so "current month" (year-only/no period) is part of the cache key.
  const attentionMonth = monthForPeriod(period ?? null);
  // The user's own Analyst (if any) also links them to the clients they logged demands for —
  // resolved here so it's part of the cache key, same pattern as getDemandAnalystScope.
  const analyst = await prisma.analyst.findUnique({ where: { userId }, select: { id: true } });
  return getCachedDashboardStats(organizationId, allowedClientIds, period ?? null, attentionMonth, analyst?.id ?? null);
}

async function getCachedDashboardStats(
  organizationId: string,
  allowedClientIds: string[],
  period: Period | null,
  attentionMonth: { year: number; month: number },
  analystId: string | null
) {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats(organizationId, allowedClientIds, periodToDateRange(period), attentionMonth, analystId);
}
