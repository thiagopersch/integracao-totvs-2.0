import { Suspense } from "react"
import { listDemands } from "@/actions/demands"
import { listAllAnalysts } from "@/actions/analysts"
import { listAllClients } from "@/actions/admin/clients"
import { listAllRequesters } from "@/actions/requesters"
import { listAllDepartments } from "@/actions/departments"
import { listAllDemandTypes } from "@/actions/demand-types"
import { listAllTags } from "@/actions/tags"
import { DemandTable } from "@/components/shared/demand-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getRequestContext } from "@/lib/tenant"
import { getDemandAnalystScope } from "@/lib/demand-scope"

export default function DemandsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DemandsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DemandsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const ctx = await getRequestContext()
  const analystScope = await getDemandAnalystScope(ctx)
  const [{ data, meta }, analysts, clients, requesters, departments, demandTypes, tags] = await Promise.all([
    listDemands({
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
      filters: params.status ? { status: params.status } : undefined,
    }, ctx.organizationId, analystScope),
    listAllAnalysts(),
    listAllClients(),
    listAllRequesters(),
    listAllDepartments(),
    listAllDemandTypes(),
    listAllTags(),
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
    />
  )
}
