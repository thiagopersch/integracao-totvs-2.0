import { Skeleton } from "@/components/ui/skeleton"

/** First-paint placeholder of the dashboard shell (sidebar + top bar + page header + table). */
export function ShellSkeleton() {
  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden w-64 shrink-0 flex-col gap-2 border-r p-3 md:flex">
        <Skeleton className="mb-3 h-8 w-36" />
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-[52px] items-center justify-end gap-2 border-b px-4 md:h-[60px]">
          <Skeleton variant="circular" className="size-8" />
          <Skeleton variant="circular" className="size-8" />
          <Skeleton variant="circular" className="size-8" />
        </div>
        <div className="space-y-4 p-4 md:p-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    </div>
  )
}
