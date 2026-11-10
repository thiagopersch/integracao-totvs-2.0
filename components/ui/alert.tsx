import * as React from "react"
import MuiAlert from "@mui/material/Alert"

import { cn } from "@/lib/utils"

const SEVERITY = { default: "info", destructive: "error", warning: "warning" } as const

/** MUI Alert. Keeps the old composition: an optional lucide icon as first child, then AlertTitle/AlertDescription. */
function Alert({
  className,
  variant = "default",
  children,
  ...props
}: React.ComponentProps<"div"> & { variant?: "default" | "destructive" | "warning" | null }) {
  const parts = React.Children.toArray(children)
  const first = parts[0]
  const hasIcon = React.isValidElement(first) && typeof first.type !== "string" && !(first.props as { "data-slot"?: string })["data-slot"] && !["AlertTitle", "AlertDescription", "AlertAction"].includes((first.type as { name?: string }).name ?? "")
  const icon = hasIcon ? first : false
  const rest = hasIcon ? parts.slice(1) : parts
  return (
    <MuiAlert
      data-slot="alert"
      severity={SEVERITY[variant ?? "default"]}
      variant="outlined"
      icon={icon as React.ReactNode}
      className={cn("relative w-full text-left text-sm [&_.MuiAlert-icon_svg]:size-4", className)}
      sx={{ py: 0.5, px: 1.25, alignItems: "flex-start", "& .MuiAlert-message": { display: "grid", gap: 0.25, width: "100%", py: 0.75 }, "& .MuiAlert-icon": { py: 1, mr: 1 } }}
      {...(props as object)}
    >
      {rest}
    </MuiAlert>
  )
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("font-medium [&_a]:underline [&_a]:underline-offset-3", className)} {...props} />
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="alert-description"
      className={cn("text-sm text-balance opacity-90 md:text-pretty [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4", className)}
      {...props}
    />
  )
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-action" className={cn("absolute top-2 right-2", className)} {...props} />
}

export { Alert, AlertAction, AlertDescription, AlertTitle }
