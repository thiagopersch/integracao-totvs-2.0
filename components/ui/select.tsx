"use client"

import * as React from "react"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import ListSubheader from "@mui/material/ListSubheader"
import Divider from "@mui/material/Divider"
import ButtonBase from "@mui/material/ButtonBase"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { popoverOrigins } from "@/components/ui/popover"

/**
 * Compound Select (same API the app had on Base UI: `items`, `value`, `onValueChange`,
 * SelectTrigger/SelectValue/SelectContent/SelectItem) rendered with MUI ButtonBase + Menu.
 */
type SelectItemDef = { value: string | null; label: React.ReactNode }
type SelectItems = SelectItemDef[] | Record<string, React.ReactNode>

type SelectCtx = {
  value: string | null | undefined
  setValue: (value: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  anchorEl: HTMLElement | null
  setAnchorEl: (el: HTMLElement | null) => void
  labelOf: (value: string | null | undefined) => React.ReactNode
  registerLabel: (value: string, label: React.ReactNode) => void
  disabled?: boolean
  name?: string
}
const SelectContext = React.createContext<SelectCtx | null>(null)
function useSelect() {
  const ctx = React.useContext(SelectContext)
  if (!ctx) throw new Error("Select parts must be used inside <Select>")
  return ctx
}

type SelectProps = {
  value?: string | null
  defaultValue?: string | null
  onValueChange?: (value: string) => void
  items?: SelectItems
  disabled?: boolean
  name?: string
  required?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}

function Select({ value, defaultValue, onValueChange, items, disabled, name, open, onOpenChange, children }: SelectProps) {
  const [inner, setInner] = React.useState<string | null | undefined>(defaultValue)
  const current = value !== undefined ? value : inner
  const [openInner, setOpenInner] = React.useState(false)
  const isOpen = open ?? openInner
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  const labels = React.useRef(new Map<string, React.ReactNode>())
  const [, bump] = React.useReducer((n: number) => n + 1, 0)

  const itemLabels = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    if (Array.isArray(items)) for (const item of items) map.set(String(item.value), item.label)
    else if (items) for (const [k, v] of Object.entries(items)) map.set(k, v)
    return map
  }, [items])

  const ctx = React.useMemo<SelectCtx>(
    () => ({
      value: current,
      setValue: (next) => {
        if (value === undefined) setInner(next)
        onValueChange?.(next)
      },
      open: isOpen,
      setOpen: (next) => {
        setOpenInner(next)
        onOpenChange?.(next)
      },
      anchorEl,
      setAnchorEl,
      labelOf: (v) => (v == null ? undefined : (itemLabels.get(String(v)) ?? labels.current.get(String(v)))),
      registerLabel: (v, label) => {
        if (!labels.current.has(v)) {
          labels.current.set(v, label)
          if (v === String(current)) bump()
        }
      },
      disabled,
      name,
    }),
    [current, value, onValueChange, isOpen, onOpenChange, anchorEl, itemLabels, disabled, name]
  )

  return (
    <SelectContext.Provider value={ctx}>
      {children}
      {name && <input type="hidden" name={name} value={current ?? ""} />}
    </SelectContext.Provider>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<"button">, "ref"> & { size?: "sm" | "default" }) {
  const ctx = useSelect()
  const isDisabled = disabled ?? ctx.disabled
  return (
    <ButtonBase
      ref={ctx.setAnchorEl}
      data-slot="select-trigger"
      data-size={size}
      data-placeholder={ctx.value == null || ctx.value === "" ? "" : undefined}
      aria-haspopup="listbox"
      aria-expanded={ctx.open}
      disabled={isDisabled}
      onClick={() => ctx.setOpen(!ctx.open)}
      className={cn(
        "flex w-fit cursor-pointer items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors select-none",
        "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50",
        "aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground",
        "data-[size=default]:h-8 data-[size=sm]:h-7 dark:bg-input/30 dark:hover:bg-input/50",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      sx={{ justifyContent: "space-between", font: "inherit", color: "inherit" }}
      {...(props as Record<string, unknown>)}
    >
      {children}
      <ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />
    </ButtonBase>
  )
}

function SelectValue({
  className,
  placeholder,
  children,
}: {
  className?: string
  placeholder?: React.ReactNode
  children?: React.ReactNode | ((value: string | null | undefined) => React.ReactNode)
}) {
  const ctx = useSelect()
  const hasValue = ctx.value != null && ctx.value !== ""
  let content: React.ReactNode
  if (typeof children === "function") content = children(ctx.value)
  else if (children !== undefined) content = children
  else content = hasValue ? (ctx.labelOf(ctx.value) ?? ctx.value) : placeholder
  return (
    <span data-slot="select-value" className={cn("line-clamp-1 flex min-w-0 flex-1 items-center gap-1.5 text-left", className)}>
      {content}
    </span>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  align = "start",
}: {
  className?: string
  children?: React.ReactNode
  side?: "top" | "bottom" | "left" | "right"
  sideOffset?: number
  align?: "start" | "center" | "end"
  alignOffset?: number
  alignItemWithTrigger?: boolean
}) {
  const ctx = useSelect()
  return (
    <Menu
      open={ctx.open && Boolean(ctx.anchorEl)}
      anchorEl={ctx.anchorEl}
      onClose={() => ctx.setOpen(false)}
      // Mounted while closed so each SelectItem registers its label for <SelectValue>.
      keepMounted
      {...popoverOrigins(side, align)}
      slotProps={{
        paper: {
          "data-slot": "select-content",
          className: cn("max-h-80 text-sm", className),
          style: { minWidth: ctx.anchorEl?.offsetWidth },
          sx: { mt: 0.5, border: 1, borderColor: "divider" },
        } as React.ComponentProps<"div">,
        list: { dense: true, role: "listbox" },
      }}
    >
      {children}
    </Menu>
  )
}

function SelectGroup({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="select-group" role="group" className={cn("py-0.5", className)}>
      {children}
    </div>
  )
}

function SelectLabel({ className, children }: { className?: string; children?: React.ReactNode }) {
  return (
    <ListSubheader data-slot="select-label" disableSticky className={cn("text-xs leading-7", className)}>
      {children}
    </ListSubheader>
  )
}

function textOf(node: React.ReactNode): React.ReactNode {
  return node
}

function SelectItem({
  className,
  children,
  value,
  disabled,
  label,
}: {
  className?: string
  children?: React.ReactNode
  value: string | null
  disabled?: boolean
  label?: string
}) {
  const ctx = useSelect()
  const key = String(value)
  const { registerLabel } = ctx
  React.useEffect(() => {
    registerLabel(key, label ?? textOf(children))
  }, [registerLabel, key, label, children])
  const selected = ctx.value != null && String(ctx.value) === key
  return (
    <MenuItem
      data-slot="select-item"
      role="option"
      aria-selected={selected}
      selected={selected}
      disabled={disabled}
      className={cn("gap-2 pr-8 text-sm [&_svg:not([class*='size-'])]:size-4", className)}
      onClick={() => {
        ctx.setValue(value as string)
        ctx.setOpen(false)
      }}
    >
      <span className="flex flex-1 shrink-0 items-center gap-2 whitespace-nowrap">{children}</span>
      {selected && <CheckIcon className="absolute right-2 size-4" />}
    </MenuItem>
  )
}

function SelectSeparator({ className }: { className?: string }) {
  return <Divider data-slot="select-separator" className={className} sx={{ my: 0.5 }} />
}

function SelectScrollUpButton() {
  return null
}
function SelectScrollDownButton() {
  return null
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
