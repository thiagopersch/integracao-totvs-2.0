import { Suspense } from "react"
import { listAnalysts } from "@/actions/analysts"
import { AnalystTable } from "@/components/shared/analyst-table"
import { Skeleton } from "@/components/ui/skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function AnalystsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <AnalystsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function AnalystsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listAnalysts({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  }, organizationId)

  return <AnalystTable data={data} meta={meta} />
}
