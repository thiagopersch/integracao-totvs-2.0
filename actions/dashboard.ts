"use server"

import { cacheTag } from "next/cache";
import { dashboardService } from "@/services/dashboard.service";

export async function getDashboardStats() {
  "use cache";
  cacheTag("dashboard");
  return dashboardService.getStats();
}
