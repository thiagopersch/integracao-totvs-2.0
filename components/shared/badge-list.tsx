"use client"

import { ColorBadge } from "@/components/shared/color-badge"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

interface BadgeListProps {
  items: { id: string; name: string; color: string }[]
  /** How many badges show inline; the rest go behind a "+N" tooltip. */
  max?: number
}

/** First `max` colored badges inline, the rest behind a "+N" tooltip (tags, analysts, requesters, setores, clients). */
export function BadgeList({ items, max = 2 }: BadgeListProps) {
  if (items.length === 0) return "-"
  const visible = items.slice(0, max)
  const hidden = items.slice(max)
  return (
    <div className="flex min-w-0 max-w-full items-center gap-1">
      {/* A long single name ellipsizes (full name on hover) instead of being clipped by the cell. */}
      {visible.map((item) => (
        <ColorBadge key={item.id} label={item.name} color={item.color} className="min-w-0 max-w-full" title={item.name} />
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge variant="secondary" className="shrink-0 cursor-default">
                +{hidden.length}
              </Badge>
            }
          />
          <TooltipContent variant="surface">
            <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {hidden.map((item) => (
                <ColorBadge key={item.id} label={item.name} color={item.color} />
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}
