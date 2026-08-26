import { getDashboardStats } from "@/actions/dashboard"
import { DashboardClient } from "./dashboard-client"

export default async function DashboardPage() {
  const {
    stats,
    recentLogs,
    chartData,
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
