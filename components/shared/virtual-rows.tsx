"use client"

import { useVirtualizer } from "@tanstack/react-virtual"

/** Lists at or above this size render only the visible rows. */
export const VIRTUALIZE_AT = 100

/**
 * Windowed rendering for a plain <table>/<div> list: renders the visible `renderRow`s plus two
 * spacer elements that keep the scrollbar the size of the full list. Keeps real table layout
 * (column widths still come from the header), unlike absolutely-positioned rows.
 */
export function VirtualRows({
  count,
  estimateSize = 33,
  scrollRef,
  renderRow,
  renderSpacer,
  overscan = 12,
}: {
  count: number
  estimateSize?: number
  scrollRef: React.RefObject<HTMLElement | null>
  renderRow: (index: number) => React.ReactNode
  /** Spacer markup for the container type, e.g. a <tr><td colSpan /></tr> for tables. */
  renderSpacer: (height: number, key: string) => React.ReactNode
  overscan?: number
}) {
  const virtualizer = useVirtualizer({ count, getScrollElement: () => scrollRef.current, estimateSize: () => estimateSize, overscan })
  const items = virtualizer.getVirtualItems()
  const top = items[0]?.start ?? 0
  const bottom = virtualizer.getTotalSize() - (items[items.length - 1]?.end ?? 0)
  return (
    <>
      {top > 0 && renderSpacer(top, "spacer-top")}
      {items.map((item) => renderRow(item.index))}
      {bottom > 0 && renderSpacer(bottom, "spacer-bottom")}
    </>
  )
}
