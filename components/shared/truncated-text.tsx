"use client"

import { useEffect, useRef, useState } from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface TruncatedTextProps {
  text: string
  className?: string
}

/**
 * Truncates long text with an ellipsis and only shows a tooltip when the text actually overflows.
 * The width cap scales with the viewport so wide screens show more text instead of leaving the column empty.
 */
export function TruncatedText({ text, className }: TruncatedTextProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const [truncated, setTruncated] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const checkOverflow = () => setTruncated(el.scrollWidth > el.clientWidth)
    checkOverflow()
    const observer = new ResizeObserver(checkOverflow)
    observer.observe(el)
    return () => observer.disconnect()
  }, [text])

  const span = (
    <span ref={ref} className={cn("block min-w-0 max-w-[max(16rem,24vw)] flex-1 truncate", className)}>
      {text}
    </span>
  )

  if (!truncated) return span

  return (
    <Tooltip>
      <TooltipTrigger render={span} />
      <TooltipContent>{text}</TooltipContent>
    </Tooltip>
  )
}
