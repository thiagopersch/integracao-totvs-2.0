import { Suspense } from "react"
import { listNotifications } from "@/actions/notifications"
import { NotificationTable } from "@/components/shared/notification-table"
import { Skeleton } from "@/components/ui/skeleton"

export default function NotificationsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  return (
    <div className="p-6">
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <NotificationsContent searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function NotificationsContent({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const params = await searchParams
  const sort = params.sort
    ? { field: params.sort.split(":")[0], direction: params.sort.split(":")[1] as "asc" | "desc" }
    : undefined
  const { data, meta, unreadCount } = await listNotifications(Number(params.page) || 1, Number(params.pageSize) || 20, false, sort)

  return <NotificationTable data={data} meta={meta} unreadCount={unreadCount} />
}
