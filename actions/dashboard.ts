"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";
import { getCurrentOrganizationId } from "@/lib/tenant";

export async function getDashboardStats() {
  const organizationId = await getCurrentOrganizationId();
  return getCachedDashboardStats(organizationId);
}

async function getCachedDashboardStats(organizationId: string) {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats(organizationId);
}
