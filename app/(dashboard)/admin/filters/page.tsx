import { Suspense } from "react"
import { listFilters } from "@/actions/admin/filters"
import { FilterTable } from "@/components/shared/filter-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function FiltersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <FiltersContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function FiltersContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { data, meta } = await listFilters({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <FilterTable data={data} meta={meta} />
}
