import { Suspense } from "react"
import { listDeletionErrors } from "@/actions/admin/deletion-logs"
import { DeletionLogTable } from "@/components/shared/deletion-log-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function DeletionLogsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <DeletionLogsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function DeletionLogsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const sort = params.sort
    ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" }
    : undefined
  const { data, meta } = await listDeletionErrors(Number(params.page) || 1, Number(params.pageSize) || 20, sort)

  return <DeletionLogTable data={data} meta={meta} />
}
