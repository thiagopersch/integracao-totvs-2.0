"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"

const STORAGE_KEY = "ai-assistant-bubble-pos"
const SIZE = 48
const MARGIN = 16
/** Pointer travel (px) below which a press counts as a click, not a drag. */
const DRAG_THRESHOLD = 5

type Side = "left" | "right"
interface StoredPos {
  side: Side
  /** Distance from the top of the viewport; null = default bottom corner. */
  y: number | null
}

function readStored(): StoredPos {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<StoredPos> | null
    if (value && (value.side === "left" || value.side === "right")) {
      return { side: value.side, y: typeof value.y === "number" && Number.isFinite(value.y) ? value.y : null }
    }
  } catch {
    // storage unavailable — fall back to the default corner
  }
  return { side: "right", y: null }
}

function writeStored(pos: StoredPos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pos))
  } catch {
    // ignore — position just won't persist
  }
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max))

interface DraggableBubbleProps {
  onActivate: () => void
  label: string
  title: string
  children: React.ReactNode
}

/** Floating round button that can be dragged anywhere and snaps to the nearest side edge (left or
 *  right) on release. The position is remembered per browser. A press without movement (or the
 *  keyboard) activates it. Rendered client-only (the assistant is loaded with ssr: false). */
export function DraggableBubble({ onActivate, label, title, children }: DraggableBubbleProps) {
  const [pos, setPos] = useState<StoredPos>(readStored)
  const [viewport, setViewport] = useState(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)
  const start = useRef<{ px: number; py: number; ox: number; oy: number; moved: boolean } | null>(null)

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const maxY = viewport.h - SIZE - MARGIN
  const restingTop = clamp(pos.y ?? maxY, MARGIN, maxY)
  const restingLeft = pos.side === "left" ? MARGIN : viewport.w - SIZE - MARGIN

  function onPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (e.button !== 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    start.current = { px: e.clientX, py: e.clientY, ox: e.clientX - rect.left, oy: e.clientY - rect.top, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const s = start.current
    if (!s) return
    if (!s.moved && Math.hypot(e.clientX - s.px, e.clientY - s.py) < DRAG_THRESHOLD) return
    s.moved = true
    setDrag({ x: clamp(e.clientX - s.ox, 0, viewport.w - SIZE), y: clamp(e.clientY - s.oy, 0, viewport.h - SIZE) })
  }

  function onPointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const s = start.current
    start.current = null
    if (!s) return
    if (!s.moved) {
      onActivate()
      return
    }
    const next: StoredPos = {
      side: e.clientX < viewport.w / 2 ? "left" : "right",
      y: clamp(e.clientY - s.oy, MARGIN, maxY),
    }
    setPos(next)
    setDrag(null)
    writeStored(next)
  }

  function onPointerCancel() {
    start.current = null
    setDrag(null)
  }

  return (
    <Button
      size="icon"
      aria-label={label}
      title={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      // Pointer presses are handled in onPointerUp; this only catches keyboard activation (detail 0).
      onClick={(e) => {
        if (e.detail === 0) onActivate()
      }}
      className="fixed z-40 size-12 touch-none select-none rounded-full shadow-lg cursor-grab active:cursor-grabbing"
      style={{
        left: drag ? drag.x : restingLeft,
        top: drag ? drag.y : restingTop,
        transition: drag ? "none" : "left 200ms ease, top 200ms ease, background-color 250ms",
      }}
    >
      {children}
    </Button>
  )
}
