"use client"

import * as React from "react"
import Drawer from "@mui/material/Drawer"
import IconButton from "@mui/material/IconButton"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type Ctx = { open: boolean; setOpen: (open: boolean) => void }
const SheetContext = React.createContext<Ctx | null>(null)
function useSheet() {
  const ctx = React.useContext(SheetContext)
  if (!ctx) throw new Error("Sheet parts must be used inside <Sheet>")
  return ctx
}

function Sheet({
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
  const value = React.useMemo(() => ({ open: isOpen, setOpen }), [isOpen, setOpen])
  return <SheetContext.Provider value={value}>{children}</SheetContext.Provider>
}

function SheetTrigger(props: TriggerProps) {
  const { setOpen } = useSheet()
  return renderTrigger(props, { onClick: () => setOpen(true), "data-slot": "sheet-trigger" })
}

function SheetClose(props: TriggerProps) {
  const { setOpen } = useSheet()
  return renderTrigger(props, { onClick: () => setOpen(false), "data-slot": "sheet-close" })
}

function SheetContent({
  className,
  children,
  side = "right",
  showCloseButton = true,
  style,
  ...props
}: React.ComponentProps<"div"> & { side?: "top" | "right" | "bottom" | "left"; showCloseButton?: boolean }) {
  const { open, setOpen } = useSheet()
  const horizontal = side === "left" || side === "right"
  return (
    <Drawer
      anchor={side}
      open={open}
      onClose={() => setOpen(false)}
      slotProps={{
        paper: {
          "data-slot": "sheet-content",
          "data-side": side,
          className: cn("flex flex-col gap-4 text-sm", horizontal ? "h-full w-3/4 sm:max-w-sm" : "h-auto", className),
          style,
          ...props,
        } as React.ComponentProps<"div">,
      }}
    >
      {children}
      {showCloseButton && (
        <IconButton aria-label="Fechar" size="small" onClick={() => setOpen(false)} sx={{ position: "absolute", top: 12, right: 12 }}>
          <XIcon className="size-4" />
        </IconButton>
      )}
    </Drawer>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-header" className={cn("flex flex-col gap-0.5 p-4", className)} {...props} />
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="sheet-footer" className={cn("mt-auto flex flex-col gap-2 p-4", className)} {...props} />
}

function SheetTitle({ className, ...props }: React.ComponentProps<"h2">) {
  return <h2 data-slot="sheet-title" className={cn("font-heading text-base font-semibold text-foreground", className)} {...props} />
}

function SheetDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p data-slot="sheet-description" className={cn("text-sm text-muted-foreground", className)} {...props} />
}

export { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger }
