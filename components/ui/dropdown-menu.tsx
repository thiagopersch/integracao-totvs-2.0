"use client"

import * as React from "react"
import Menu from "@mui/material/Menu"
import MenuItem from "@mui/material/MenuItem"
import Divider from "@mui/material/Divider"
import { CheckIcon, ChevronRightIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { popoverOrigins } from "@/components/ui/popover"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type Ctx = { open: boolean; setOpen: (open: boolean) => void; anchorEl: HTMLElement | null; setAnchorEl: (el: HTMLElement | null) => void }
export const MenuContext = React.createContext<Ctx | null>(null)
function useMenu() {
  const ctx = React.useContext(MenuContext)
  if (!ctx) throw new Error("DropdownMenu parts must be used inside <DropdownMenu>")
  return ctx
}

function DropdownMenu({
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
  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function DropdownMenuTrigger(props: TriggerProps) {
  const { open, setOpen, setAnchorEl } = useMenu()
  return renderTrigger(props, {
    ref: setAnchorEl,
    onClick: () => setOpen(!open),
    "aria-haspopup": "menu",
    "aria-expanded": open,
    "data-slot": "dropdown-menu-trigger",
  })
}

type Side = "top" | "bottom" | "left" | "right" | "inline-start" | "inline-end"

function DropdownMenuContent({
  align = "start",
  alignOffset: _alignOffset,
  side = "bottom",
  sideOffset = 4,
  className,
  children,
  style,
}: {
  align?: "start" | "center" | "end"
  alignOffset?: number
  side?: Side
  sideOffset?: number
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}) {
  const { open, setOpen, anchorEl } = useMenu()
  return (
    <Menu
      open={open && Boolean(anchorEl)}
      anchorEl={anchorEl}
      onClose={() => setOpen(false)}
      {...popoverOrigins(side, align)}
      slotProps={{
        paper: { "data-slot": "dropdown-menu-content", className: cn("min-w-32 text-sm", className), style, sx: { mt: side === "bottom" ? `${sideOffset}px` : 0, border: 1, borderColor: "divider" } } as React.ComponentProps<"div">,
        list: { dense: true, sx: { py: 0.5 } },
      }}
    >
      {children}
    </Menu>
  )
}

function DropdownMenuGroup({ children }: { children?: React.ReactNode; className?: string }) {
  return <>{children}</>
}

function DropdownMenuLabel({ className, inset, ...props }: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      className={cn("px-3 py-1.5 text-xs font-medium text-muted-foreground", inset && "pl-8", className)}
      {...props}
    />
  )
}

type ItemProps = Omit<React.ComponentProps<typeof MenuItem>, "onClick"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  closeOnClick?: boolean
}

function DropdownMenuItem({ className, inset, variant = "default", onClick, closeOnClick = true, ...props }: ItemProps) {
  const ctx = React.useContext(MenuContext)
  return (
    <MenuItem
      data-slot="dropdown-menu-item"
      className={cn("gap-2 text-sm [&_svg:not([class*='size-'])]:size-4", inset && "pl-8", className)}
      sx={variant === "destructive" ? { color: "error.main", "& svg": { color: "error.main" } } : undefined}
      onClick={(event) => {
        onClick?.(event)
        if (closeOnClick) ctx?.setOpen(false)
      }}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  inset,
  ...props
}: Omit<ItemProps, "variant"> & { checked?: boolean; onCheckedChange?: (checked: boolean) => void }) {
  return (
    <DropdownMenuItem
      role="menuitemcheckbox"
      aria-checked={checked}
      closeOnClick={false}
      className={cn("pl-8", inset && "pl-8", className)}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="absolute left-2 flex size-4 items-center justify-center">{checked && <CheckIcon className="size-4" />}</span>
      {children}
    </DropdownMenuItem>
  )
}

const RadioContext = React.createContext<{ value?: string; onValueChange?: (value: string) => void }>({})

function DropdownMenuRadioGroup({
  value,
  onValueChange,
  children,
}: {
  value?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
}) {
  return <RadioContext.Provider value={{ value, onValueChange }}>{children}</RadioContext.Provider>
}

function DropdownMenuRadioItem({ className, children, value, ...props }: Omit<ItemProps, "variant" | "value"> & { value: string }) {
  const radio = React.useContext(RadioContext)
  const checked = radio.value === value
  return (
    <DropdownMenuItem role="menuitemradio" aria-checked={checked} className={cn("pl-8", className)} onClick={() => radio.onValueChange?.(value)} {...props}>
      <span className="absolute left-2 flex size-4 items-center justify-center">{checked && <CheckIcon className="size-4" />}</span>
      {children}
    </DropdownMenuItem>
  )
}

function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Divider data-slot="dropdown-menu-separator" className={className} sx={{ my: 0.5 }} />
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="dropdown-menu-shortcut" className={cn("ml-auto text-xs tracking-widest text-muted-foreground", className)} {...props} />
}

const SubContext = React.createContext<{ open: boolean; setOpen: (open: boolean) => void; anchorEl: HTMLElement | null; setAnchorEl: (el: HTMLElement | null) => void } | null>(null)

function DropdownMenuSub({ children, open, onOpenChange }: { children?: React.ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [isOpen, setOpen] = useOpenState(open, false, onOpenChange)
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)
  return <SubContext.Provider value={{ open: isOpen, setOpen, anchorEl, setAnchorEl }}>{children}</SubContext.Provider>
}

function DropdownMenuSubTrigger({ className, inset, children, ...props }: Omit<ItemProps, "variant">) {
  const sub = React.useContext(SubContext)
  return (
    <MenuItem
      ref={sub?.setAnchorEl}
      data-slot="dropdown-menu-sub-trigger"
      aria-haspopup="menu"
      aria-expanded={sub?.open}
      className={cn("gap-2 text-sm [&_svg:not([class*='size-'])]:size-4", inset && "pl-8", className)}
      onClick={() => sub?.setOpen(!sub.open)}
      onMouseEnter={() => sub?.setOpen(true)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </MenuItem>
  )
}

function DropdownMenuSubContent({ className, children }: { className?: string; children?: React.ReactNode }) {
  const sub = React.useContext(SubContext)
  const root = React.useContext(MenuContext)
  if (!sub) return null
  return (
    <MenuContext.Provider value={root ? { ...root, setOpen: (open) => { sub.setOpen(open); root.setOpen(open) } } : null}>
      <Menu
        open={sub.open && Boolean(sub.anchorEl)}
        anchorEl={sub.anchorEl}
        onClose={() => sub.setOpen(false)}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{ paper: { className: cn("min-w-32 text-sm", className) }, list: { dense: true, onMouseLeave: () => sub.setOpen(false) } }}
      >
        {children}
      </Menu>
    </MenuContext.Provider>
  )
}

export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
}
