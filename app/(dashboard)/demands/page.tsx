import { Suspense } from "react"
import { listDemands } from "@/actions/demands"
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
  const { data, meta } = await listDemands({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  }, ctx.organizationId, analystScope)

  return <DemandTable data={data} meta={meta} />
}
