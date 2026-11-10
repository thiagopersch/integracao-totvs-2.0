"use client"

import * as React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"

/** Above this many options an Autocomplete renders its list virtualized. */
export const VIRTUALIZE_OPTIONS_AT = 100

const ROW_HEIGHT = 36

/**
 * Autocomplete `slots.listbox` that only mounts the visible options. MUI passes the options as
 * an array of <li> children; keyboard navigation still works because MUI scrolls the listbox by
 * the highlighted index (`scrollToIndex` below keeps the highlighted option mounted).
 */
export function VirtualListbox({ children, ref, style, ...props }: React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLUListElement> }) {
  const items = React.Children.toArray(children)
  const scrollRef = React.useRef<HTMLUListElement | null>(null)
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8,
  })

  const setRefs = React.useCallback(
    (node: HTMLUListElement | null) => {
      scrollRef.current = node
      if (typeof ref === "function") ref(node)
      else if (ref) (ref as React.RefObject<HTMLUListElement | null>).current = node
    },
    [ref]
  )

  return (
    <ul {...props} ref={setRefs} style={{ ...style, maxHeight: 320, overflow: "auto", position: "relative", padding: 0 }}>
      <li aria-hidden style={{ height: virtualizer.getTotalSize(), listStyle: "none" }} />
      {virtualizer.getVirtualItems().map((row) => {
        const item = items[row.index] as React.ReactElement<{ style?: React.CSSProperties }>
        return React.cloneElement(item, {
          key: row.key,
          style: { ...item.props.style, position: "absolute", top: 0, left: 0, right: 0, height: row.size, transform: `translateY(${row.start}px)` },
        })
      })}
    </ul>
  )
}
