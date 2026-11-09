"use client"

import * as React from "react"
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button"
import type { SxProps, Theme } from "@mui/material/styles"

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

const HEIGHTS: Record<ButtonSize, number> = {
  default: 32,
  xs: 24,
  sm: 28,
  lg: 36,
  icon: 32,
  "icon-xs": 24,
  "icon-sm": 28,
  "icon-lg": 36,
}

const ICON_SIZES: Partial<Record<ButtonSize, number>> = { xs: 12, sm: 14, "icon-xs": 12 }

function variantProps(variant: ButtonVariant): Pick<MuiButtonProps, "variant" | "color"> & { sx: SxProps<Theme> } {
  switch (variant) {
    case "outline":
      return {
        variant: "outlined",
        color: "inherit",
        sx: { borderColor: "divider", bgcolor: "background.paper", "&:hover": { bgcolor: "action.hover", borderColor: "divider" } },
      }
    case "secondary":
      return {
        variant: "contained",
        color: "inherit",
        sx: { bgcolor: "action.selected", color: "text.primary", boxShadow: "none", "&:hover": { bgcolor: "action.focus", boxShadow: "none" } },
      }
    case "ghost":
      return { variant: "text", color: "inherit", sx: { "&:hover": { bgcolor: "action.hover" } } }
    case "destructive":
      return { variant: "contained", color: "error", sx: {} }
    case "link":
      return {
        variant: "text",
        color: "primary",
        sx: { px: 0, minHeight: 0, height: "auto", "&:hover": { bgcolor: "transparent", textDecoration: "underline" } },
      }
    default:
      return { variant: "contained", color: "primary", sx: {} }
  }
}

export type ButtonProps = Omit<MuiButtonProps, "variant" | "size" | "color"> & {
  variant?: ButtonVariant
  size?: ButtonSize
  /** Render as another element (e.g. `render={<Link href="/x" />}`) — kept from the Base UI API. */
  render?: React.ReactElement<Record<string, unknown>>
  /** Base UI compat — MUI decides this from `component`. */
  nativeButton?: boolean
}

function Button({ variant = "default", size = "default", render, nativeButton: _nativeButton, sx, children, ...props }: ButtonProps) {
  const v = variantProps(variant)
  const isIcon = size.startsWith("icon")
  const height = HEIGHTS[size]
  const iconSize = ICON_SIZES[size] ?? 16

  const renderProps: Record<string, unknown> = {}
  let component: React.ElementType | undefined
  if (render && React.isValidElement(render)) {
    component = render.type as React.ElementType
    Object.assign(renderProps, render.props)
  }

  return (
    <MuiButton
      data-slot="button"
      variant={v.variant}
      color={v.color}
      {...(component ? { component } : {})}
      {...renderProps}
      {...props}
      sx={[
        {
          height,
          minWidth: isIcon ? height : 0,
          width: isIcon ? height : undefined,
          px: isIcon ? 0 : size === "xs" ? 1 : 1.25,
          gap: size === "xs" || size === "sm" ? 0.5 : 0.75,
          fontSize: size === "xs" ? "0.75rem" : size === "sm" ? "0.8rem" : "0.875rem",
          lineHeight: 1,
          "& svg": { flexShrink: 0, pointerEvents: "none" },
          [`& svg:not([class*="size-"])`]: { width: iconSize, height: iconSize },
        },
        v.sx,
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children ?? (renderProps.children as React.ReactNode)}
    </MuiButton>
  )
}

export { Button }

const LINK_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  default: "bg-primary text-primary-foreground shadow-none hover:bg-primary/90",
  outline: "border border-border bg-background hover:bg-muted",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
  ghost: "hover:bg-muted",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline",
}
const LINK_SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "h-8 px-2.5",
  xs: "h-6 px-2 text-xs",
  sm: "h-7 px-2.5 text-[0.8rem]",
  lg: "h-9 px-2.5",
  icon: "size-8",
  "icon-xs": "size-6",
  "icon-sm": "size-7",
  "icon-lg": "size-9",
}

/** Classes that make a plain element (e.g. a next/link `<Link>`) look like <Button>. */
function buttonVariants({ variant = "default", size = "default" }: { variant?: ButtonVariant | null; size?: ButtonSize | null } = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[7px] text-sm font-medium whitespace-nowrap transition-colors select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    LINK_VARIANT_CLASSES[variant ?? "default"],
    LINK_SIZE_CLASSES[size ?? "default"],
  ].join(" ")
}

export { buttonVariants }
