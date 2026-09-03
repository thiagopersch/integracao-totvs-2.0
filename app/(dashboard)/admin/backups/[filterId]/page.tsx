import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getFilterByIdWithRelations } from "@/actions/admin/filters"
import { listLatestBackupsForFilter, listBackupRunsForFilter } from "@/actions/admin/backups"
import { BackupsDetailClient } from "@/components/shared/backups-detail-client"
import { Skeleton } from "@/components/ui/skeleton"
import { getRequestContext } from "@/lib/tenant"

export default function BackupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ filterId: string }>
  searchParams: Promise<Record<string, string>>
}) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <BackupsContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function BackupsContent({
  params,
  searchParams,
}: {
  params: Promise<{ filterId: string }>
  searchParams: Promise<Record<string, string>>
}) {
  const { filterId } = await params
  const search = await searchParams
  const { organizationId, allowedClientIds } = await getRequestContext()

  const filter = await getFilterByIdWithRelations(filterId, organizationId, allowedClientIds)
  if (!filter) notFound()

  const [sentences, runs] = await Promise.all([
    listLatestBackupsForFilter(
      filterId,
      {
        page: Number(search.page) || 1,
        pageSize: Number(search.pageSize) || 10,
        sort: search.sort
          ? { field: search.sort.split(":")[0], direction: search.sort.split(":")[1] as "asc" | "desc" }
          : undefined,
        search: search.search || undefined,
        filters: {
          codColigada: search.codColigada || undefined,
          codSystem: search.codSystem || undefined,
          dateFrom: search.dateFrom || undefined,
          dateTo: search.dateTo || undefined,
        },
      },
      organizationId,
      allowedClientIds
    ),
    listBackupRunsForFilter(
      filterId,
      {
        page: Number(search.runsPage) || 1,
        pageSize: Number(search.runsPageSize) || 10,
        sort: search.runsSort
          ? { field: search.runsSort.split(":")[0], direction: search.runsSort.split(":")[1] as "asc" | "desc" }
          : undefined,
      },
      organizationId,
      allowedClientIds
    ),
  ])

  return (
    <BackupsDetailClient
      filter={filter}
      sentences={sentences.data}
      sentencesMeta={sentences.meta}
      runs={runs.data}
      runsMeta={runs.meta}
    />
  )
}
