import { Suspense } from "react"
import { cookies } from "next/headers"
import { listDemands, getDemandPeriodOptions } from "@/actions/demands"
import { listAllAnalysts } from "@/actions/analysts"
import { listAllClients } from "@/actions/admin/clients"
import { listAllRequesters } from "@/actions/requesters"
import { listAllDepartments } from "@/actions/departments"
import { listAllDemandTypes } from "@/actions/demand-types"
import { listAllTags } from "@/actions/tags"
import { DemandTable } from "@/components/shared/demand-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { getDemandAnalystScope } from "@/lib/demand-scope"
import { PERIOD_COOKIE_NAME, resolvePeriod } from "@/lib/period"

// Demand import can process 100+ rows in batched transactions (see import.service.ts bulkCreate)
// — raise the Server Action timeout for this page beyond the platform default so large imports
// have time to finish.
export const maxDuration = 60

export default function DemandsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <DemandsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DemandsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const ctx = await getRequestContext()
  const analystScope = await getDemandAnalystScope(ctx)
  const cookieStore = await cookies()
  const period = resolvePeriod(params, cookieStore.get(PERIOD_COOKIE_NAME)?.value)

  const [{ data, meta, totalsByClient }, analysts, clients, requesters, departments, demandTypes, tags, periodOptions] = await Promise.all([
    listDemands({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: params.status ? { status: params.status } : undefined,
    }, ctx.organizationId, ctx.allowedClientIds, analystScope, period),
    listAllAnalysts(),
    listAllClients(),
    listAllRequesters(),
    listAllDepartments(),
    listAllDemandTypes(),
    listAllTags(),
    getDemandPeriodOptions(),
  ])

  return (
    <DemandTable
      data={data}
      meta={meta}
      analysts={analysts}
      clients={clients}
      requesters={requesters}
      departments={departments}
      demandTypes={demandTypes}
      tags={tags}
      totalsByClient={totalsByClient}
      period={period}
      years={periodOptions.years}
      monthsByYear={periodOptions.monthsByYear}
    />
  )
}
