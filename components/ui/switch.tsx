"use client"

import * as React from "react"
import MuiSwitch from "@mui/material/Switch"

import { cn } from "@/lib/utils"

function Switch({
  className,
  size = "default",
  checked,
  defaultChecked,
  onCheckedChange,
  ...props
}: Omit<React.ComponentProps<typeof MuiSwitch>, "size" | "onChange"> & {
  size?: "sm" | "default"
  onCheckedChange?: (checked: boolean) => void
}) {
  return (
    <MuiSwitch
      data-slot="switch"
      data-size={size}
      checked={checked}
      defaultChecked={defaultChecked}
      onChange={(_event, value) => onCheckedChange?.(value)}
      size={size === "sm" ? "small" : "medium"}
      className={cn("shrink-0", className)}
      {...props}
    />
  )
}

export { Switch }
