"use client"

import * as React from "react"
import MuiButton, { type ButtonProps as MuiButtonProps } from "@mui/material/Button"
import type { SxProps, Theme } from "@mui/material/styles"

type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"
type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

// Material heights: 36 medium (default), 32 small, 40 large; icon buttons are square.
const HEIGHTS: Record<ButtonSize, number> = {
  default: 36,
  xs: 28,
  sm: 32,
  lg: 40,
  icon: 36,
  "icon-xs": 28,
  "icon-sm": 32,
  "icon-lg": 40,
}

const ICON_SIZES: Partial<Record<ButtonSize, number>> = { xs: 14, "icon-xs": 14 }

const TONAL = "rgba(var(--mui-palette-primary-mainChannel) / 0.12)"
const TONAL_HOVER = "rgba(var(--mui-palette-primary-mainChannel) / 0.2)"

function variantProps(variant: ButtonVariant): Pick<MuiButtonProps, "variant" | "color"> & { sx: SxProps<Theme> } {
  switch (variant) {
    case "outline":
      return { variant: "outlined", color: "primary", sx: {} }
    case "secondary":
      // Material "tonal" button: primary-tinted container, primary text, no shadow.
      return {
        variant: "contained",
        color: "primary",
        sx: (theme) => ({
          bgcolor: TONAL,
          color: theme.vars?.palette.primary.dark,
          boxShadow: "none",
          "&:hover": { bgcolor: TONAL_HOVER, boxShadow: "none" },
          "&:active": { boxShadow: "none" },
          ...theme.applyStyles("dark", { color: theme.vars?.palette.primary.light }),
        }),
      }
    case "ghost":
      return { variant: "text", color: "inherit", sx: {} }
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
          px: isIcon ? 0 : size === "xs" ? 1.25 : size === "sm" ? 1.5 : 2,
          gap: size === "xs" || size === "sm" ? 0.75 : 1,
          fontSize: size === "xs" ? "0.75rem" : size === "sm" ? "0.8125rem" : "0.875rem",
          ...(isIcon && { borderRadius: "50%" }),
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
  default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md",
  outline: "border border-primary/50 text-primary hover:bg-primary/5",
  secondary: "bg-primary/12 text-primary hover:bg-primary/20",
  ghost: "hover:bg-foreground/5",
  destructive: "bg-destructive text-white hover:bg-destructive/90",
  link: "text-primary underline-offset-4 hover:underline",
}
const LINK_SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "h-9 px-4",
  xs: "h-7 px-2.5 text-xs",
  sm: "h-8 px-3 text-[0.8125rem]",
  lg: "h-10 px-5",
  icon: "size-9 rounded-full",
  "icon-xs": "size-7 rounded-full",
  "icon-sm": "size-8 rounded-full",
  "icon-lg": "size-10 rounded-full",
}

/** Classes that make a plain element (e.g. a next/link `<Link>`) look like <Button>. */
function buttonVariants({ variant = "default", size = "default" }: { variant?: ButtonVariant | null; size?: ButtonSize | null } = {}) {
  return [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium tracking-[0.02em] whitespace-nowrap transition-colors select-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    LINK_VARIANT_CLASSES[variant ?? "default"],
    LINK_SIZE_CLASSES[size ?? "default"],
  ].join(" ")
}

export { buttonVariants }
