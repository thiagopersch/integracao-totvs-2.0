import * as React from "react"
import Chip from "@mui/material/Chip"

import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "outline" | "ghost" | "link"

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-primary text-primary-foreground",
  secondary: "bg-secondary text-secondary-foreground",
  destructive: "bg-destructive/10 text-destructive dark:bg-destructive/20",
  success: "bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  outline: "border border-border bg-transparent text-foreground",
  ghost: "bg-transparent hover:bg-muted",
  link: "bg-transparent text-primary underline-offset-4 hover:underline",
}

/** Status/label pill (MUI Chip). Tailwind classes passed in `className` still recolor it. */
function Badge({
  className,
  variant = "default",
  children,
  render,
  onClick,
  style,
  title,
}: {
  className?: string
  variant?: BadgeVariant | null
  children?: React.ReactNode
  render?: React.ReactElement
  onClick?: React.MouseEventHandler<HTMLDivElement>
  style?: React.CSSProperties
  title?: string
}) {
  return (
    <Chip
      data-slot="badge"
      component={render && React.isValidElement(render) ? (render.type as React.ElementType) : "span"}
      {...(render && React.isValidElement(render) ? (render.props as object) : {})}
      label={children}
      onClick={onClick}
      style={style}
      title={title}
      size="small"
      className={cn(
        "h-5 w-fit shrink-0 gap-1 rounded-full px-0 text-xs font-medium [&_svg:not([class*='size-'])]:size-3",
        VARIANT_CLASSES[variant ?? "default"],
        className
      )}
      sx={{ "& .MuiChip-label": { px: 1, display: "inline-flex", alignItems: "center", gap: 0.5 }, bgcolor: "unset", color: "unset" }}
    />
  )
}

const badgeVariants = ({ variant = "default" }: { variant?: BadgeVariant | null } = {}) => VARIANT_CLASSES[variant ?? "default"]

export { Badge, badgeVariants }
