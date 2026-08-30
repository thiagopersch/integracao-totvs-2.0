"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";
import { getRequestContext } from "@/lib/tenant";

export async function getDashboardStats() {
  const { organizationId, allowedClientIds } = await getRequestContext();
  return getCachedDashboardStats(organizationId, allowedClientIds);
}

async function getCachedDashboardStats(organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats(organizationId, allowedClientIds);
}
