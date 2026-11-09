"use client"

import * as React from "react"
import Menu from "@mui/material/Menu"

import { cn } from "@/lib/utils"
import { MenuContext, DropdownMenuItem, DropdownMenuCheckboxItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type OpenDetails = { cancel: () => void }
type Ctx = { open: boolean; setOpen: (open: boolean) => void; requestOpen: () => boolean; position: { top: number; left: number } | null; setPosition: (p: { top: number; left: number } | null) => void }
const ContextMenuContext = React.createContext<Ctx | null>(null)
function useContextMenu() {
  const ctx = React.useContext(ContextMenuContext)
  if (!ctx) throw new Error("ContextMenu parts must be used inside <ContextMenu>")
  return ctx
}

function ContextMenu({ open, onOpenChange, children }: { open?: boolean; onOpenChange?: (open: boolean, details: OpenDetails) => void; children?: React.ReactNode }) {
  const notify = React.useCallback((next: boolean) => onOpenChange?.(next, { cancel: () => {} }), [onOpenChange])
  const [isOpen, setOpen] = useOpenState(open, false, notify)
  // Lets onOpenChange(true, details) veto opening with details.cancel(), like Base UI.
  const requestOpen = React.useCallback(() => {
    let canceled = false
    onOpenChange?.(true, { cancel: () => { canceled = true } })
    if (canceled) return false
    if (open === undefined) setOpen(true)
    return true
  }, [onOpenChange, open, setOpen])
  const [position, setPosition] = React.useState<{ top: number; left: number } | null>(null)
  const value = React.useMemo(() => ({ open: isOpen, setOpen, requestOpen, position, setPosition }), [isOpen, setOpen, requestOpen, position])
  return <ContextMenuContext.Provider value={value}>{children}</ContextMenuContext.Provider>
}

function ContextMenuTrigger({ className, ...props }: TriggerProps & { style?: React.CSSProperties }) {
  const { requestOpen, setPosition } = useContextMenu()
  // Base UI's context trigger renders a <div> by default (it wraps arbitrary content).
  const render = props.render ?? <div />
  return renderTrigger(
    { ...props, render, className: cn(className) },
    {
      "data-slot": "context-menu-trigger",
      onContextMenu: (event: React.MouseEvent<HTMLElement>) => {
        ;(props.onContextMenu as ((e: React.MouseEvent<HTMLElement>) => void) | undefined)?.(event)
        if (event.defaultPrevented) return
        event.preventDefault()
        setPosition({ top: event.clientY, left: event.clientX })
        requestOpen()
      },
    }
  )
}

function ContextMenuPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function ContextMenuContent({ className, children, onClick, style }: { className?: string; children?: React.ReactNode; onClick?: React.MouseEventHandler<HTMLDivElement>; style?: React.CSSProperties }) {
  const { open, setOpen, position } = useContextMenu()
  const menuCtx = React.useMemo(() => ({ open, setOpen, anchorEl: null, setAnchorEl: () => {} }), [open, setOpen])
  return (
    <MenuContext.Provider value={menuCtx}>
      <Menu
        open={open && position !== null}
        onClose={() => setOpen(false)}
        anchorReference="anchorPosition"
        anchorPosition={position ?? undefined}
        onClick={onClick}
        slotProps={{ paper: { "data-slot": "context-menu-content", className: cn("min-w-36 text-sm", className), style, sx: { border: 1, borderColor: "divider" } } as React.ComponentProps<"div">, list: { dense: true } }}
      >
        {children}
      </Menu>
    </MenuContext.Provider>
  )
}

const ContextMenuItem = DropdownMenuItem
const ContextMenuCheckboxItem = DropdownMenuCheckboxItem
const ContextMenuSeparator = DropdownMenuSeparator
const ContextMenuLabel = DropdownMenuLabel

export { ContextMenu, ContextMenuCheckboxItem, ContextMenuContent, ContextMenuItem, ContextMenuLabel, ContextMenuPortal, ContextMenuSeparator, ContextMenuTrigger }

export {
  DropdownMenuSub as ContextMenuSub,
  DropdownMenuSubTrigger as ContextMenuSubTrigger,
  DropdownMenuSubContent as ContextMenuSubContent,
  DropdownMenuRadioGroup as ContextMenuRadioGroup,
  DropdownMenuRadioItem as ContextMenuRadioItem,
} from "@/components/ui/dropdown-menu"
