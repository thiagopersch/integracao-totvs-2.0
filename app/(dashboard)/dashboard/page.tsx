import { Suspense } from "react"
import { cookies } from "next/headers"
import { getDashboardStats } from "@/actions/dashboard"
import { getDemandPeriodOptions } from "@/actions/demands"
import { DashboardClient } from "./dashboard-client"
import DashboardLoading from "../loading"
import { PERIOD_COOKIE_NAME, resolvePeriod } from "@/lib/period"

export default function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardData searchParams={searchParams} />
    </Suspense>
  )
}

async function DashboardData({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const cookieStore = await cookies()
  const period = resolvePeriod(params, cookieStore.get(PERIOD_COOKIE_NAME)?.value)

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
      demandsByAnalyst,
      demandsByClient,
      clientHoursRanking,
    },
    periodOptions,
  ] = await Promise.all([getDashboardStats(period), getDemandPeriodOptions()])

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
      demandsByAnalyst={demandsByAnalyst}
      demandsByClient={demandsByClient}
      clientHoursRanking={clientHoursRanking}
      period={period}
      years={periodOptions.years}
      monthsByYear={periodOptions.monthsByYear}
    />
  )
}
