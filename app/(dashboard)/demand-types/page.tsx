import { Suspense } from "react"
import { listDemandTypes } from "@/actions/demand-types"
import { DemandTypeTable } from "@/components/shared/demand-type-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function DemandTypesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <DemandTypesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DemandTypesContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listDemandTypes({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
  }, organizationId)

  return <DemandTypeTable data={data} meta={meta} />
}
