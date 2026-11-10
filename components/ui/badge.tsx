import * as React from "react"
import Chip from "@mui/material/Chip"

import { cn } from "@/lib/utils"

type BadgeVariant = "default" | "secondary" | "destructive" | "success" | "outline" | "ghost" | "link"

type ChipLook = { color: "default" | "primary" | "error" | "success"; variant: "filled" | "outlined"; className: string }

// Material chips: filled primary, neutral filled, outlined, and soft (tonal) error/success.
const LOOK: Record<BadgeVariant, ChipLook> = {
  default: { color: "primary", variant: "filled", className: "" },
  secondary: { color: "default", variant: "filled", className: "" },
  destructive: { color: "error", variant: "filled", className: "bg-destructive/12 text-destructive" },
  success: { color: "success", variant: "filled", className: "bg-emerald-600/12 text-emerald-700 dark:bg-emerald-400/16 dark:text-emerald-300" },
  outline: { color: "default", variant: "outlined", className: "" },
  ghost: { color: "default", variant: "outlined", className: "border-transparent bg-transparent" },
  link: { color: "primary", variant: "outlined", className: "border-transparent bg-transparent underline-offset-4 hover:underline" },
}

/** Status/label pill (MUI Chip, small). Tailwind classes passed in `className` still recolor it. */
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
  const look = LOOK[variant ?? "default"]
  return (
    <Chip
      data-slot="badge"
      component={render && React.isValidElement(render) ? (render.type as React.ElementType) : "span"}
      {...(render && React.isValidElement(render) ? (render.props as object) : {})}
      label={children}
      onClick={onClick}
      clickable={Boolean(onClick)}
      style={style}
      title={title}
      size="small"
      color={look.color}
      variant={look.variant}
      className={cn("h-6 w-fit max-w-full shrink-0 text-xs font-medium [&_svg:not([class*='size-'])]:size-3.5", look.className, className)}
      sx={{ "& .MuiChip-label": { px: 1, display: "inline-flex", alignItems: "center", gap: 0.5 } }}
    />
  )
}

const badgeVariants = ({ variant = "default" }: { variant?: BadgeVariant | null } = {}) => {
  const look = LOOK[variant ?? "default"]
  const base = look.variant === "outlined" ? "border border-border" : look.color === "primary" ? "bg-primary text-primary-foreground" : "bg-foreground/8"
  return cn("rounded-lg", base, look.className)
}

export { Badge, badgeVariants }
