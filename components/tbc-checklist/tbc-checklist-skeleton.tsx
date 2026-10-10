import { Skeleton } from "@/components/ui/skeleton"

export function TbcChecklistSkeleton() {
  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 rounded-md" />
        <Skeleton className="h-6 w-72 max-w-full" />
      </div>
      <div className="flex items-end gap-2">
        <Skeleton className="h-9 w-80 max-w-full" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <div className="flex w-full shrink-0 flex-col gap-2 rounded-md border p-3 lg:w-[380px]">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
        <div className="flex min-h-48 flex-1 items-center justify-center rounded-md border">
          <Skeleton className="h-24 w-24 rounded-full" />
        </div>
      </div>
    </div>
  )
}
