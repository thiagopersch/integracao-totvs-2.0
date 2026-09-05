import { Suspense } from "react"
import { listProcesses } from "@/actions/admin/processes"
import { ProcessTable } from "@/components/shared/process-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function ProcessesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <ProcessesContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ProcessesContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listProcesses({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  }, organizationId)

  return <ProcessTable data={data} meta={meta} />
}
