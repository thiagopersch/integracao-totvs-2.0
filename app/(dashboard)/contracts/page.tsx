import { Suspense } from "react"
import { cookies } from "next/headers"
import { listContracts } from "@/actions/contracts"
import { getDemandPeriodOptions } from "@/actions/demands"
import { listAllClients } from "@/actions/admin/clients"
import { ContractTable } from "@/components/shared/contract-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { PERIOD_COOKIE_NAME, resolvePeriod } from "@/lib/period"
import { formatMonthLabel, monthForPeriod } from "@/lib/contract-usage"

export default function ContractsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <ContractsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ContractsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { organizationId, allowedClientIds } = await getRequestContext()
  const cookieStore = await cookies()
  const period = resolvePeriod(params, cookieStore.get(PERIOD_COOKIE_NAME)?.value)
  // Consumption is shown for the selected month (current month for a year-only/no period), so a
  // contract created after the client's demands still shows the hours already logged that month.
  const usageMonth = monthForPeriod(period)
  const [{ data, meta }, clients, periodOptions] = await Promise.all([
    listContracts(
      {
        page: Number(params.page) || 1,
        pageSize: Number(params.pageSize) || 10,
        search: params.search,
        sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
        filters: params.status ? { status: params.status } : undefined,
      },
      organizationId,
      allowedClientIds,
      usageMonth
    ),
    listAllClients(),
    getDemandPeriodOptions(),
  ])

  return (
    <ContractTable
      data={data}
      meta={meta}
      clients={clients}
      usageMonth={usageMonth}
      usageMonthLabel={formatMonthLabel(usageMonth)}
      period={period}
      years={periodOptions.years}
      monthsByYear={periodOptions.monthsByYear}
    />
  )
}
