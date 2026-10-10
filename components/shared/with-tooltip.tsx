"use client"

import type { ReactElement, ReactNode } from "react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface WithTooltipProps {
  /** Tooltip text — nothing is wrapped when empty. */
  label?: ReactNode
  children: ReactElement
  /** Puts the trigger on a wrapping span — a disabled button gets no pointer events, so a tooltip
   *  that must show while it is disabled can't sit on the button itself. */
  disabledSafe?: boolean
  side?: "top" | "bottom" | "left" | "right"
}

/** The app's Tooltip around a button — used instead of the native `title` attribute. */
export function WithTooltip({ label, children, disabledSafe, side }: WithTooltipProps) {
  if (!label) return children
  return (
    <Tooltip>
      {disabledSafe ? (
        <TooltipTrigger render={<span className="inline-flex" />}>{children}</TooltipTrigger>
      ) : (
        <TooltipTrigger render={children} />
      )}
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}
