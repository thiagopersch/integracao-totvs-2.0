import { Suspense } from "react"
import { listTags } from "@/actions/tags"
import { TagTable } from "@/components/shared/tag-table"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getCurrentOrganizationId } from "@/lib/tenant"

export default function TagsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<TableSkeleton />}>
        <TagsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function TagsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const organizationId = await getCurrentOrganizationId()
  const { data, meta } = await listTags(
    {
      page: Number(params.page) || 1,
      pageSize: Number(params.pageSize) || 10,
      search: params.search,
      sort: params.sort ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" } : undefined,
    },
    organizationId
  )

  return <TagTable data={data} meta={meta} />
}
