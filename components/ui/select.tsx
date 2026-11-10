"use client"

import * as React from "react"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import ListSubheader from "@mui/material/ListSubheader"
import Divider from "@mui/material/Divider"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import OutlinedInput from "@mui/material/OutlinedInput"
import { CheckIcon, ChevronDownIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { popoverOrigins } from "@/components/ui/popover"
import { useFloatingLabel } from "@/components/ui/field"

const BOX = /^(?:[a-z-]+:)*(?:h-|min-h-|max-h-|rounded|bg-|border)/
function splitBoxClasses(className: string) {
  const box: string[] = []
  const rest: string[] = []
  for (const token of className.split(/\s+/).filter(Boolean)) (BOX.test(token) ? box : rest).push(token)
  return { box: box.join(" "), rest: rest.join(" ") }
}

/**
 * Compound Select (same API the app had on Base UI: `items`, `value`, `onValueChange`,
 * SelectTrigger/SelectValue/SelectContent/SelectItem) rendered with MUI ButtonBase + Menu.
 */
type SelectItemDef = { value: string | null; label: React.ReactNode }
type SelectGroupDef = { label: React.ReactNode; items: SelectItemDef[] }
type SelectItems = ReadonlyArray<SelectItemDef | SelectGroupDef> | Record<string, React.ReactNode>

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- callers narrow the value to their own union type
  onValueChange?: (value: any) => void
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
  const [labels, setLabels] = React.useState<Record<string, React.ReactNode>>({})
  const registerLabel = React.useCallback(
    (v: string, label: React.ReactNode) => setLabels((prev) => (v in prev ? prev : { ...prev, [v]: label })),
    []
  )

  const itemLabels = React.useMemo(() => {
    const map = new Map<string, React.ReactNode>()
    if (Array.isArray(items))
      for (const entry of items as ReadonlyArray<SelectItemDef | SelectGroupDef>) {
        if ("items" in entry) for (const item of entry.items) map.set(String(item.value), item.label)
        else map.set(String(entry.value), entry.label)
      }
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
      labelOf: (v) => (v == null ? undefined : (itemLabels.get(String(v)) ?? labels[String(v)])),
      registerLabel,
      disabled,
      name,
    }),
    [current, value, onValueChange, isOpen, onOpenChange, anchorEl, itemLabels, labels, registerLabel, disabled, name]
  )

  return (
    <SelectContext.Provider value={ctx}>
      {children}
      {name && <input type="hidden" name={name} value={current ?? ""} />}
    </SelectContext.Provider>
  )
}

type TriggerSurfaceProps = React.HTMLAttributes<HTMLDivElement> & {
  disabled?: boolean
  onToggle: () => void
  ref?: React.Ref<HTMLDivElement>
}

/** The "input" of the outlined trigger: a focusable combobox div (like MUI's own Select). */
function TriggerSurface({ disabled, onToggle, ref, className, children, onFocus, onBlur, ...rest }: TriggerSurfaceProps & Record<string, unknown>) {
  const aria: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(rest)) if (k.startsWith("aria-") || k.startsWith("data-") || k === "id" || k === "title" || k === "onKeyDown") aria[k] = v
  return (
    <div
      ref={ref}
      role="combobox"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      className={className}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={() => !disabled && onToggle()}
      {...aria}
      onKeyDown={(e) => {
        ;(aria.onKeyDown as React.KeyboardEventHandler<HTMLDivElement> | undefined)?.(e)
        if (disabled || e.defaultPrevented) return
        if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
          e.preventDefault()
          onToggle()
        }
      }}
    >
      {children}
    </div>
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  disabled,
  id,
  ...props
}: Omit<React.ComponentProps<"button">, "ref"> & { size?: "sm" | "default" }) {
  const { setAnchorEl, value, open, setOpen, disabled: ctxDisabled } = useSelect()
  const floating = useFloatingLabel(id)
  const isDisabled = Boolean(disabled ?? ctxDisabled)
  const isEmpty = value == null || value === ""
  const [focused, setFocused] = React.useState(false)
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  const shrink = !!floating && (floating.static || !isEmpty || open || focused)
  const { box, rest } = splitBoxClasses(className ?? "")
  const height = size === "sm" ? "h-8" : floating ? "h-10" : "h-9"

  const surfaceId = id ?? floating?.id
  const labelId = React.useId()
  const surfaceProps = {
    ...(props as Record<string, unknown>),
    id: surfaceId,
    // A div combobox isn't "labelable" by <label for>: name it through the floating label.
    ...(floating && !props["aria-label"] && !props["aria-labelledby"] ? { "aria-labelledby": labelId } : {}),
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    "data-slot": "select-trigger",
    "data-size": size,
    "data-placeholder": isEmpty ? "" : undefined,
    disabled: isDisabled,
    onToggle: () => setOpen(!open),
    children,
  } as Record<string, unknown>

  const input = (
    <OutlinedInput
      ref={setAnchorEl}
      disabled={isDisabled}
      error={invalid}
      label={floating?.label}
      notched={floating ? shrink : undefined}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- custom surface, like MUI's own SelectInput
      inputComponent={TriggerSurface as any}
      inputProps={surfaceProps}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      endAdornment={<ChevronDownIcon className={cn("pointer-events-none mr-2 size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      className={cn("text-sm", height, floating ? "w-full" : cn("w-fit", rest), box)}
      sx={{
        pr: 0,
        cursor: isDisabled ? "default" : "pointer",
        "& .MuiInputBase-input": {
          display: "flex",
          alignItems: "center",
          gap: 0.75,
          height: "100%",
          boxSizing: "border-box",
          py: 0,
          pl: 1.5,
          pr: 1,
          cursor: "inherit",
          whiteSpace: "nowrap",
          overflow: "hidden",
          userSelect: "none",
        },
        "& .MuiInputBase-input[data-placeholder]": { color: "text.secondary" },
        "& svg:not([class*='size-'])": { width: 16, height: 16 },
      }}
    />
  )

  if (!floating) return input
  return (
    <FormControl
      variant="outlined"
      size="small"
      error={invalid}
      disabled={isDisabled}
      focused={focused || open}
      className={cn("min-w-0", rest || "w-full")}
      {...floating.rootProps}
    >
      <InputLabel id={labelId} shrink={shrink} size="small">
        {floating.label}
      </InputLabel>
      {input}
    </FormControl>
  )
}

function SelectValue({
  className,
  placeholder,
  children,
}: {
  className?: string
  placeholder?: React.ReactNode
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- same as onValueChange
  children?: React.ReactNode | ((value: any) => React.ReactNode)
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
          elevation: 8,
          "data-slot": "select-content",
          className: cn("max-h-80 text-sm", className),
          style: { minWidth: ctx.anchorEl?.offsetWidth },
          sx: { mt: 0.5 },
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
