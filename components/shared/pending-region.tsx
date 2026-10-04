import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface PendingRegionProps {
  /** True while the data shown inside is being replaced (a transition/refetch is in flight). */
  pending: boolean
  children: React.ReactNode
  className?: string
}

/**
 * Keeps the current (stale) content on screen while new data loads, dimmed and non-interactive
 * with a spinner on top — so only the component being refreshed signals loading, instead of the
 * whole page being swapped for a skeleton.
 */
export function PendingRegion({ pending, children, className }: PendingRegionProps) {
  return (
    <div className={cn("relative", className)} aria-busy={pending || undefined} data-pending={pending ? "" : undefined}>
      <div className={cn("h-full transition-opacity duration-200", pending && "pointer-events-none opacity-50")}>{children}</div>
      {pending && (
        <div className="absolute inset-0 z-20 flex items-center justify-center" role="status" aria-label="Carregando">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      )}
    </div>
  )
}
