"use client"

import * as React from "react"
import MuiPopover, { type PopoverOrigin } from "@mui/material/Popover"

import { cn } from "@/lib/utils"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type Ctx = {
  open: boolean
  setOpen: (open: boolean) => void
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
}
const PopoverContext = React.createContext<Ctx | null>(null)
function usePopover() {
  const ctx = React.useContext(PopoverContext)
  if (!ctx) throw new Error("Popover parts must be used inside <Popover>")
  return ctx
}

function Popover({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  modal?: boolean
}) {
  const [isOpen, setOpen] = useOpenState(open, defaultOpen, onOpenChange)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const value = React.useMemo(() => ({ open: isOpen, setOpen, anchorEl, setAnchorEl }), [isOpen, setOpen, anchorEl])
  return <PopoverContext.Provider value={value}>{children}</PopoverContext.Provider>
}

function PopoverTrigger(props: TriggerProps & { openOnHover?: boolean; delay?: number }) {
  const { open, setOpen, setAnchorEl } = usePopover()
  const { openOnHover: _openOnHover, delay: _delay, ...rest } = props
  return renderTrigger(rest, {
    ref: setAnchorEl,
    onClick: () => setOpen(!open),
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "data-slot": "popover-trigger",
  })
}

type Side = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"
type Align = "start" | "center" | "end"

export function popoverOrigins(side: Side = "bottom", align: Align = "center"): { anchorOrigin: PopoverOrigin; transformOrigin: PopoverOrigin } {
  const h = align === "start" ? "left" : align === "end" ? "right" : "center"
  const v = align === "start" ? "top" : align === "end" ? "bottom" : "center"
  switch (side) {
    case "top":
      return { anchorOrigin: { vertical: "top", horizontal: h }, transformOrigin: { vertical: "bottom", horizontal: h } }
    case "left":
    case "inline-start":
      return { anchorOrigin: { vertical: v, horizontal: "left" }, transformOrigin: { vertical: v, horizontal: "right" } }
    case "right":
    case "inline-end":
      return { anchorOrigin: { vertical: v, horizontal: "right" }, transformOrigin: { vertical: v, horizontal: "left" } }
    default:
      return { anchorOrigin: { vertical: "bottom", horizontal: h }, transformOrigin: { vertical: "top", horizontal: h } }
  }
}

function PopoverContent({
  className,
  align = "center",
  alignOffset: _alignOffset,
  side = "bottom",
  sideOffset = 4,
  style,
  children,
  initialFocus: _initialFocus,
  finalFocus: _finalFocus,
  ...props
}: React.ComponentProps<"div"> & {
  align?: Align
  alignOffset?: number
  side?: Side
  sideOffset?: number
  initialFocus?: unknown
  finalFocus?: unknown
}) {
  const { open, setOpen, anchorEl } = usePopover()
  const origins = popoverOrigins(side, align)
  const offset = side === "top" ? { mt: `-${sideOffset}px` } : side === "left" || side === "inline-start" ? { ml: `-${sideOffset}px` } : side === "right" || side === "inline-end" ? { ml: `${sideOffset}px` } : { mt: `${sideOffset}px` }
  return (
    <MuiPopover
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={() => setOpen(false)}
      {...origins}
      slotProps={{
        paper: {
          "data-slot": "popover-content",
          className: cn("flex w-72 flex-col gap-2.5 p-2.5 text-sm", className),
          style,
          sx: { ...offset, borderRadius: 2, border: 1, borderColor: "divider" },
          elevation: 4,
          ...props,
        } as React.ComponentProps<"div">,
      }}
    >
      {children}
    </MuiPopover>
  )
}

function PopoverHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="popover-header" className={cn("flex flex-col gap-0.5 text-sm", className)} {...props} />
}

function PopoverTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="popover-title" className={cn("font-heading font-semibold", className)} {...props} />
}

function PopoverDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="popover-description" className={cn("text-muted-foreground", className)} {...props} />
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger }
