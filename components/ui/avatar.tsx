"use client"

import * as React from "react"
import MuiAvatar from "@mui/material/Avatar"
import AvatarGroupMui from "@mui/material/AvatarGroup"

import { cn } from "@/lib/utils"

const SIZES = { sm: 24, default: 32, lg: 40 } as const

function AvatarImage(_props: { src?: string | null; alt?: string; className?: string }): React.ReactNode {
  return null
}

function AvatarFallback({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn("text-xs", className)}>{children}</span>
}

function AvatarBadge({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="avatar-badge"
      className={cn("absolute right-0 bottom-0 z-10 inline-flex size-2.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-background", className)}
      {...props}
    />
  )
}

/** MUI Avatar. Composition kept: <Avatar><AvatarImage src/><AvatarFallback>AB</AvatarFallback></Avatar>. Images load lazily. */
function Avatar({
  className,
  size = "default",
  children,
  style,
}: {
  className?: string
  size?: keyof typeof SIZES
  children?: React.ReactNode
  style?: React.CSSProperties
}) {
  const parts = React.Children.toArray(children)
  const image = parts.find((c) => React.isValidElement(c) && c.type === AvatarImage) as React.ReactElement<{ src?: string | null; alt?: string; className?: string }> | undefined
  const fallback = parts.find((c) => React.isValidElement(c) && c.type === AvatarFallback)
  const others = parts.filter((c) => c !== image && c !== fallback)
  const px = SIZES[size]
  return (
    <span data-slot="avatar" data-size={size} className={cn("relative inline-flex shrink-0", className)} style={{ width: px, height: px, ...style }}>
      <MuiAvatar
        src={image?.props.src ?? undefined}
        alt={image?.props.alt}
        slotProps={{ img: { loading: "lazy", decoding: "async" } }}
        sx={{ width: "100%", height: "100%", fontSize: size === "sm" ? 11 : 13, bgcolor: "action.selected", color: "text.secondary" }}
      >
        {fallback}
      </MuiAvatar>
      {others}
    </span>
  )
}

function AvatarGroup({ className, children, max }: { className?: string; children?: React.ReactNode; max?: number }) {
  return (
    <AvatarGroupMui data-slot="avatar-group" max={max} className={cn("*:data-[slot=avatar]:ring-2 *:data-[slot=avatar]:ring-background", className)} sx={{ justifyContent: "flex-end" }}>
      {children}
    </AvatarGroupMui>
  )
}

function AvatarGroupCount({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="avatar-group-count" className={cn("relative flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm text-muted-foreground ring-2 ring-background", className)} {...props} />
}

export { Avatar, AvatarBadge, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage }
