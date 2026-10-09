"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { CardHeader, CardTitle } from "@/components/ui/card"

interface CollapsibleCardHeaderProps {
  title: React.ReactNode
  open: boolean
  onToggle: () => void
  /** id of the `CardContent` this header shows/hides. */
  controlsId: string
  /** Shown next to the title only while collapsed (e.g. what was searched). */
  summary?: React.ReactNode
  expandLabel?: string
  collapseLabel?: string
}

/** Card header that toggles its card's content — the whole header is the click target, with the
 *  chevron on the right. Pair with `<CardContent id={controlsId} hidden={!open}>` so the content
 *  stays mounted (form values survive) while hidden. */
export function CollapsibleCardHeader({ title, open, onToggle, controlsId, summary, expandLabel = "Expandir", collapseLabel = "Recolher" }: CollapsibleCardHeaderProps) {
  return (
    <CardHeader>
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={controlsId} className="flex w-full items-center gap-3 text-left cursor-pointer">
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-3 gap-y-1">
          <CardTitle className="text-sm">{title}</CardTitle>
          {!open && summary && <span className="truncate text-xs text-muted-foreground">{summary}</span>}
        </span>
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-accent" aria-label={open ? collapseLabel : expandLabel}>
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </span>
      </button>
    </CardHeader>
  )
}
