"use client"

import * as React from "react"
import MuiAccordion from "@mui/material/Accordion"
import AccordionSummary from "@mui/material/AccordionSummary"
import AccordionDetails from "@mui/material/AccordionDetails"
import { ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type AccordionValue = string | number
type Ctx = { isOpen: (value: AccordionValue) => boolean; toggle: (value: AccordionValue) => void }
const AccordionContext = React.createContext<Ctx | null>(null)
const ItemContext = React.createContext<AccordionValue | null>(null)

function Accordion({
  value,
  defaultValue,
  onValueChange,
  multiple = false,
  className,
  children,
}: {
  value?: AccordionValue[]
  defaultValue?: AccordionValue[]
  onValueChange?: (value: never[]) => void
  multiple?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const [inner, setInner] = React.useState<AccordionValue[]>(defaultValue ?? [])
  const current = value ?? inner
  const ctx = React.useMemo<Ctx>(
    () => ({
      isOpen: (v) => current.includes(v),
      toggle: (v) => {
        const open = current.includes(v)
        const next = open ? current.filter((x) => x !== v) : multiple ? [...current, v] : [v]
        if (value === undefined) setInner(next)
        ;(onValueChange as ((v: AccordionValue[]) => void) | undefined)?.(next)
      },
    }),
    [current, multiple, value, onValueChange]
  )
  return (
    <AccordionContext.Provider value={ctx}>
      <div data-slot="accordion" className={className}>
        {children}
      </div>
    </AccordionContext.Provider>
  )
}

function AccordionItem({ className, value, children, disabled }: { className?: string; value?: AccordionValue; children?: React.ReactNode; disabled?: boolean }) {
  const ctx = React.useContext(AccordionContext)
  const fallbackId = React.useId()
  const itemValue = value ?? fallbackId
  return (
    <ItemContext.Provider value={itemValue}>
      <MuiAccordion
        data-slot="accordion-item"
        disableGutters
        elevation={1}
        disabled={disabled}
        expanded={ctx?.isOpen(itemValue) ?? false}
        onChange={() => ctx?.toggle(itemValue)}
        slotProps={{ transition: { unmountOnExit: true } }}
        className={cn("before:hidden", className)}
      >
        {children as NonNullable<React.ReactNode>}
      </MuiAccordion>
    </ItemContext.Provider>
  )
}

function AccordionTrigger({ className, children, title }: { className?: string; children?: React.ReactNode; title?: string }) {
  return (
    <AccordionSummary
      data-slot="accordion-trigger"
      title={title}
      expandIcon={<ChevronDownIcon className="size-5 text-muted-foreground" />}
      className={cn("text-left text-sm font-medium", className)}
      sx={{ "& .MuiAccordionSummary-content": { gap: 1 } }}
    >
      {children}
    </AccordionSummary>
  )
}

function AccordionContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <AccordionDetails data-slot="accordion-content" className="text-sm">
      <div className={className}>{children}</div>
    </AccordionDetails>
  )
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger }
