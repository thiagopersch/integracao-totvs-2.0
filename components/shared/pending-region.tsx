import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface PendingRegionProps {
  /** True while the data shown inside is being replaced (a transition/refetch is in flight). */
  pending: boolean
  children: React.ReactNode
  className?: string
  /** Placeholder shaped like the content (e.g. <ChartSkeleton />). Defaults to one skeleton block of the region's size. */
  skeleton?: React.ReactNode
}

/**
 * While new data loads, only this component shows a loading state: its content is swapped for a
 * Skeleton of the same size (the stale content stays in the layout, invisible, so nothing moves).
 */
export function PendingRegion({ pending, children, className, skeleton }: PendingRegionProps) {
  return (
    <div className={cn("relative", className)} aria-busy={pending || undefined} data-pending={pending ? "" : undefined}>
      <div className={cn("h-full", pending && "pointer-events-none invisible")} aria-hidden={pending || undefined}>
        {children}
      </div>
      {pending && (
        <div className="absolute inset-0 z-20 overflow-hidden" role="status" aria-label="Carregando">
          {skeleton ?? <Skeleton className="h-full w-full rounded-xl" />}
        </div>
      )}
    </div>
  )
}
