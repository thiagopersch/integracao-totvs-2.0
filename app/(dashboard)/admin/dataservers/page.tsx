import { Suspense } from "react"
import { listDataservers } from "@/actions/admin/dataservers"
import { DataserverTable } from "@/components/shared/dataserver-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function DataserversPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DataserversContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DataserversContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const { data, meta } = await listDataservers({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 10,
    search: params.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: params.status ? { status: params.status } : undefined,
  })

  return <DataserverTable data={data} meta={meta} />
}
