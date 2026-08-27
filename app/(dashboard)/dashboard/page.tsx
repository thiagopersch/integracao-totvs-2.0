import { Suspense } from "react"
import { getDashboardStats } from "@/actions/dashboard"
import { DashboardClient } from "./dashboard-client"
import DashboardLoading from "../loading"

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardData />
    </Suspense>
  )
}

async function DashboardData() {
  const {
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
  } = await getDashboardStats()

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
    />
  )
}
