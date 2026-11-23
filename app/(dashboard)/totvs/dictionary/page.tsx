import { Suspense } from "react"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { TotvsDictionaryTable } from "@/components/shared/totvs-dictionary-table"
import { requirePermission } from "@/lib/rbac"
import { listTotvsDictionary } from "@/queries/totvs-dictionary"

export default function TotvsDictionaryPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <TotvsDictionaryContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TotvsDictionaryContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requirePermission("totvs_dictionary", "read")
  const params = await searchParams
  const filters = { search: params.search || undefined, table: params.table || undefined, tablesOnly: params.tablesOnly === "true" }
  const { data, meta } = await listTotvsDictionary({
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 25,
    search: filters.search,
    sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    filters: { table: filters.table, tablesOnly: filters.tablesOnly ? "true" : undefined },
  })

  return <TotvsDictionaryTable data={data} meta={meta} filters={filters} />
}
