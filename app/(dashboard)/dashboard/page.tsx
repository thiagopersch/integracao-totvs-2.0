import { Suspense } from "react"
import { cookies } from "next/headers"
import { getDashboardStats } from "@/actions/dashboard"
import { getDemandPeriodOptions } from "@/actions/demands"
import { DashboardClient } from "./dashboard-client"
import { DashboardSkeleton } from "./dashboard-skeleton"
import { PERIOD_COOKIE_NAME, resolvePeriod } from "@/lib/period"
import { getProjectPortfolio } from "@/queries/projects"
import { getRequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"
import { getTodayDateOnly } from "@/lib/export-period"

export default function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardData searchParams={searchParams} />
    </Suspense>
  )
}

async function DashboardData({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const cookieStore = await cookies()
  const period = resolvePeriod(params, cookieStore.get(PERIOD_COOKIE_NAME)?.value)
  const { organizationId, userId, allowedClientIds, permissions } = await getRequestContext()
  // Projects/tasks block only for who can see the Gestão de Projetos module.
  const canSeeProjects = hasPermission(permissions, "projects", "read")

  const [
    {
      stats,
      recentLogs,
      chartData,
      clientStatusData,
      tbcStatusData,
      filterStatusData,
      sentencesByCategory,
      demandsByStatus,
      demandsByPriority,
      demandsByType,
      demandsByTag,
      demandsByAnalyst,
      demandsByClient,
      clientHoursRanking,
      contractsUsage,
      contractsUsageMonthLabel,
    },
    periodOptions,
    projectPortfolio,
  ] = await Promise.all([
    getDashboardStats(period),
    getDemandPeriodOptions(),
    canSeeProjects ? getProjectPortfolio({ organizationId, userId, allowedClientIds }) : null,
  ])

  return (
    <DashboardClient
      stats={stats}
      recentLogs={recentLogs}
      chartData={chartData}
      clientStatusData={clientStatusData}
      tbcStatusData={tbcStatusData}
      filterStatusData={filterStatusData}
      sentencesByCategory={sentencesByCategory}
      demandsByStatus={demandsByStatus}
      demandsByPriority={demandsByPriority}
      demandsByType={demandsByType}
      demandsByTag={demandsByTag}
      demandsByAnalyst={demandsByAnalyst}
      demandsByClient={demandsByClient}
      clientHoursRanking={clientHoursRanking}
      contractsUsage={contractsUsage}
      contractsUsageMonthLabel={contractsUsageMonthLabel}
      period={period}
      years={periodOptions.years}
      monthsByYear={periodOptions.monthsByYear}
      projectPortfolio={projectPortfolio}
      today={getTodayDateOnly().toISOString().slice(0, 10)}
    />
  )
}
