"use client"

import * as React from "react"
import MuiDialog from "@mui/material/Dialog"
import IconButton from "@mui/material/IconButton"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type DialogContextValue = { open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string }
const DialogContext = React.createContext<DialogContextValue | null>(null)

function useDialog() {
  const ctx = React.useContext(DialogContext)
  if (!ctx) throw new Error("Dialog parts must be used inside <Dialog>")
  return ctx
}

type DialogProps = {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
  /** Base UI compat (ignored: MUI dialogs are always modal). */
  modal?: boolean
}

function Dialog({ open, defaultOpen, onOpenChange, children }: DialogProps) {
  const [isOpen, setOpen] = useOpenState(open, defaultOpen, onOpenChange)
  const id = React.useId()
  const value = React.useMemo(
    () => ({ open: isOpen, setOpen, titleId: `${id}-title`, descriptionId: `${id}-description` }),
    [isOpen, setOpen, id]
  )
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>
}

function DialogTrigger(props: TriggerProps) {
  const { open, setOpen } = useDialog()
  return renderTrigger(props, { onClick: () => setOpen(true), "aria-haspopup": "dialog", "aria-expanded": open, "data-slot": "dialog-trigger" })
}

function DialogClose(props: TriggerProps & { variant?: React.ComponentProps<typeof Button>["variant"] }) {
  const { setOpen } = useDialog()
  const { variant: _variant, ...rest } = props
  return renderTrigger(rest, { onClick: () => setOpen(false), "data-slot": "dialog-close" })
}

function DialogPortal({ children }: { children?: React.ReactNode; container?: unknown }) {
  return <>{children}</>
}

function DialogOverlay(_props: { className?: string }) {
  return null
}

type DialogContentProps = Omit<React.ComponentProps<"div">, "title"> & {
  showCloseButton?: boolean
  headerActions?: React.ReactNode
  /** Portal target — defaults to document.body. Pass an element scoped to a CSS-scoped subtree (e.g. the mapeador prototipo preview) so descendant-selector styles still apply to the dialog's content. */
  container?: Element | React.RefObject<Element | null> | null
  /** Base UI compat. */
  initialFocus?: unknown
  finalFocus?: unknown
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  headerActions,
  container,
  initialFocus: _initialFocus,
  finalFocus: _finalFocus,
  style,
  ...props
}: DialogContentProps) {
  const { open, setOpen, titleId, descriptionId } = useDialog()
  const resolvedContainer =
    container && typeof container === "object" && "current" in container ? () => container.current as Element : (container as Element | undefined)

  return (
    <MuiDialog
      open={open}
      onClose={() => setOpen(false)}
      container={resolvedContainer ?? undefined}
      maxWidth={false}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      slotProps={{
        paper: {
          "data-slot": "dialog-content",
          className: cn(
            "relative flex flex-col overflow-hidden text-sm",
            "h-[80vh] max-h-[80vh] w-[80vw] max-w-[80vw]",
            "max-sm:h-[90vh]! max-sm:max-h-[90vh]! max-sm:w-[90vw]! max-sm:max-w-[90vw]!",
            className
          ),
          style,
          sx: { m: 0, borderRadius: 4 },
          ...props,
        } as React.ComponentProps<"div">,
      }}
    >
      {children}
      {(headerActions || showCloseButton) && (
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
          {headerActions}
          {showCloseButton && (
            <IconButton data-slot="dialog-close" aria-label="Fechar" size="small" onClick={() => setOpen(false)}>
              <XIcon className="size-4" />
            </IconButton>
          )}
        </div>
      )}
    </MuiDialog>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dialog-header" className={cn("flex shrink-0 flex-col gap-2 px-6 pt-5 pb-3 pr-20", className)} {...props} />
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("min-h-0 flex-1 space-y-4 overflow-x-auto overflow-y-auto px-6 py-3", className)}
      {...props}
    />
  )
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showCloseButton?: boolean }) {
  const { setOpen } = useDialog()
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex shrink-0 flex-col-reverse gap-2 px-6 pt-3 pb-5 sm:flex-row sm:justify-end", className)}
      {...props}
    >
      {children}
      {showCloseButton && (
        <Button variant="outline" onClick={() => setOpen(false)}>
          Fechar
        </Button>
      )}
    </div>
  )
}

function DialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useDialog()
  return <h2 id={titleId} data-slot="dialog-title" className={cn("font-heading text-base leading-none font-semibold", className)} {...props} />
}

function DialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useDialog()
  return (
    <p
      id={descriptionId}
      data-slot="dialog-description"
      className={cn("text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
