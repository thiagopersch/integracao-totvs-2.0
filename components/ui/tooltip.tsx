"use client"

import * as React from "react"
import MuiTooltip from "@mui/material/Tooltip"

import { cn } from "@/lib/utils"
import { renderTrigger, type TriggerProps } from "@/components/ui/slot"

/** Base UI compat: MUI tooltips need no provider. */
function TooltipProvider({ children }: { children?: React.ReactNode; delay?: number }) {
  return <>{children}</>
}

type Side = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"

type TooltipContentProps = Omit<React.ComponentProps<"div">, "content"> & {
  side?: Side
  sideOffset?: number
  align?: "start" | "center" | "end"
  alignOffset?: number
  /** "default" is the inverted (foreground-on-background) style used for text hints. "surface" follows the
   *  popover palette, for rich content (images, lists). */
  variant?: "default" | "surface"
}

/** Marker part: its props are read by <Tooltip>, it never renders by itself. */
function TooltipContent(_props: TooltipContentProps): React.ReactNode {
  return null
}

function TooltipTrigger(props: TriggerProps) {
  return renderTrigger(props, { "data-slot": "tooltip-trigger" })
}

function placementOf(side: Side = "top", align: "start" | "center" | "end" = "center") {
  const base = side === "inline-start" ? "left" : side === "inline-end" ? "right" : side
  if (align === "center") return base
  return `${base}-${align}` as const
}

function Tooltip({
  children,
  open,
  onOpenChange,
  disabled,
}: {
  children?: React.ReactNode
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  delay?: number
}) {
  const parts = React.Children.toArray(children)
  const contentEl = parts.find((child) => React.isValidElement(child) && child.type === TooltipContent) as
    | React.ReactElement<TooltipContentProps>
    | undefined
  const triggerParts = parts.filter((child) => child !== contentEl)
  const trigger = triggerParts.length === 1 && React.isValidElement(triggerParts[0]) ? triggerParts[0] : <span>{triggerParts}</span>

  if (!contentEl || disabled) return <>{trigger}</>

  const { children: title, className, side, align, variant = "default", style } = contentEl.props
  const surface = variant === "surface"

  return (
    <MuiTooltip
      title={title ?? ""}
      placement={placementOf(side, align) as React.ComponentProps<typeof MuiTooltip>["placement"]}
      open={open}
      onOpen={onOpenChange ? () => onOpenChange(true) : undefined}
      onClose={onOpenChange ? () => onOpenChange(false) : undefined}
      arrow={!surface}
      slotProps={{
        tooltip: {
          className: cn("text-xs", className),
          style,
          sx: surface
            ? { bgcolor: "background.paper", color: "text.primary", border: 1, borderColor: "divider", boxShadow: 4, p: 1, maxWidth: "none" }
            : { bgcolor: "text.primary", color: "background.default", "& .MuiTooltip-arrow": { color: "text.primary" } },
        },
      }}
    >
      {trigger as React.ReactElement<Record<string, unknown>>}
    </MuiTooltip>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
