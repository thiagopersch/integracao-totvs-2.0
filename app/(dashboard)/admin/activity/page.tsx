import { Suspense } from "react"
import { endOfDay } from "date-fns"
import { listActivityLog } from "@/actions/admin/activity-log"
import { ActivityLogTable } from "@/components/shared/activity-log-table"
import { Skeleton } from "@/components/ui/skeleton"
import type { ActivitySource } from "@/services/activity-log.service"

export default function ActivityLogPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <ActivityLogContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ActivityLogContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams

  const filters = {
    source: (params.source as ActivitySource) || undefined,
    dateFrom: params.dateFrom ? new Date(params.dateFrom) : undefined,
    dateTo: params.dateTo ? endOfDay(new Date(params.dateTo)) : undefined,
    search: params.search || undefined,
  }

  const { data, meta } = await listActivityLog(Number(params.page) || 1, Number(params.pageSize) || 20, filters)

  return <ActivityLogTable data={data} meta={meta} />
}
