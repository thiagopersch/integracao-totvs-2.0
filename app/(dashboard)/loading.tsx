import { Skeleton } from "@/components/ui/skeleton"
import { TableSkeleton } from "@/components/shared/table-skeleton"

export default function DashboardLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-32" />
      </div>
      <TableSkeleton />
    </div>
  )
}
