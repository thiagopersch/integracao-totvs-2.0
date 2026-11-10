"use client"

import * as React from "react"
import Collapse from "@mui/material/Collapse"

import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

const CollapsibleContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void } | null>(null)

function Root({
  open,
  defaultOpen,
  onOpenChange,
  children,
  className,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  className?: string
}) {
  const [isOpen, setOpen] = useOpenState(open, defaultOpen, onOpenChange)
  return (
    <CollapsibleContext.Provider value={{ open: isOpen, setOpen }}>
      <div data-slot="collapsible" data-open={isOpen ? "" : undefined} className={className}>
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

function Trigger(props: TriggerProps) {
  const ctx = React.useContext(CollapsibleContext)
  return renderTrigger(props, { onClick: () => ctx?.setOpen(!ctx.open), "aria-expanded": ctx?.open, "data-slot": "collapsible-trigger" })
}

function Panel({ className, children }: { className?: string; children?: React.ReactNode }) {
  const ctx = React.useContext(CollapsibleContext)
  return (
    <Collapse in={ctx?.open ?? false} unmountOnExit>
      <div data-slot="collapsible-panel" className={className}>
        {children}
      </div>
    </Collapse>
  )
}

/** Same shape as Base UI's Collapsible (Root/Trigger/Panel), animated with MUI Collapse. */
export const Collapsible = { Root, Trigger, Panel }
