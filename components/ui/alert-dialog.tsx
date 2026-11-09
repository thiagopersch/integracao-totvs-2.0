"use client"

import * as React from "react"
import MuiDialog from "@mui/material/Dialog"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { renderTrigger, useOpenState, type TriggerProps } from "@/components/ui/slot"

type Ctx = { open: boolean; setOpen: (open: boolean) => void; titleId: string; descriptionId: string }
const AlertDialogContext = React.createContext<Ctx | null>(null)
function useAlertDialog() {
  const ctx = React.useContext(AlertDialogContext)
  if (!ctx) throw new Error("AlertDialog parts must be used inside <AlertDialog>")
  return ctx
}

function AlertDialog({
  open,
  defaultOpen,
  onOpenChange,
  children,
}: {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  children?: React.ReactNode
}) {
  const [isOpen, setOpen] = useOpenState(open, defaultOpen, onOpenChange)
  const id = React.useId()
  const value = React.useMemo(() => ({ open: isOpen, setOpen, titleId: `${id}-t`, descriptionId: `${id}-d` }), [isOpen, setOpen, id])
  return <AlertDialogContext.Provider value={value}>{children}</AlertDialogContext.Provider>
}

function AlertDialogTrigger(props: TriggerProps) {
  const { setOpen } = useAlertDialog()
  return renderTrigger(props, { onClick: () => setOpen(true), "data-slot": "alert-dialog-trigger" })
}

function AlertDialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}

function AlertDialogOverlay(_props: { className?: string }) {
  return null
}

function AlertDialogContent({
  className,
  size = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & { size?: "default" | "sm" }) {
  const { open, setOpen, titleId, descriptionId } = useAlertDialog()
  return (
    <MuiDialog
      open={open}
      onClose={() => setOpen(false)}
      role="alertdialog"
      maxWidth={false}
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      slotProps={{
        paper: {
          "data-slot": "alert-dialog-content",
          "data-size": size,
          className: cn("grid w-full gap-4 p-4 text-sm", size === "sm" ? "max-w-xs" : "max-w-xs sm:max-w-sm", className),
          sx: { m: 2, borderRadius: 3 },
          ...props,
        } as React.ComponentProps<"div">,
      }}
    >
      {children}
    </MuiDialog>
  )
}

function AlertDialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-dialog-header" className={cn("grid gap-1.5 text-left", className)} {...props} />
}

function AlertDialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-footer"
      className={cn("-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  )
}

function AlertDialogMedia({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-dialog-media"
      className={cn("mb-2 inline-flex size-10 items-center justify-center rounded-md bg-muted *:[svg:not([class*='size-'])]:size-6", className)}
      {...props}
    />
  )
}

function AlertDialogTitle({ className, ...props }: React.ComponentProps<"h2">) {
  const { titleId } = useAlertDialog()
  return <h2 id={titleId} data-slot="alert-dialog-title" className={cn("font-heading text-base font-semibold", className)} {...props} />
}

function AlertDialogDescription({ className, ...props }: React.ComponentProps<"p">) {
  const { descriptionId } = useAlertDialog()
  return (
    <p
      id={descriptionId}
      data-slot="alert-dialog-description"
      className={cn("text-sm text-balance text-muted-foreground md:text-pretty", className)}
      {...props}
    />
  )
}

function AlertDialogAction({ className, ...props }: React.ComponentProps<typeof Button>) {
  return <Button data-slot="alert-dialog-action" className={className} {...props} />
}

function AlertDialogCancel({
  className,
  variant = "outline",
  size = "default",
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { setOpen } = useAlertDialog()
  return (
    <Button
      data-slot="alert-dialog-cancel"
      variant={variant}
      size={size}
      className={className}
      onClick={(event) => {
        onClick?.(event)
        setOpen(false)
      }}
      {...props}
    />
  )
}

export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogTitle,
  AlertDialogTrigger,
}
