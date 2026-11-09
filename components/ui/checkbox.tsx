"use client"

import * as React from "react"
import MuiCheckbox from "@mui/material/Checkbox"

import { cn } from "@/lib/utils"

type CheckboxProps = Omit<React.ComponentProps<typeof MuiCheckbox>, "onChange" | "checked"> & {
  checked?: boolean | "indeterminate"
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
  "data-indeterminate"?: boolean
}

function Checkbox({ className, checked, indeterminate, onCheckedChange, "data-indeterminate": dataIndeterminate, ...props }: CheckboxProps) {
  const isIndeterminate = indeterminate ?? (checked === "indeterminate" || dataIndeterminate === true)
  return (
    <MuiCheckbox
      data-slot="checkbox"
      checked={checked === true}
      indeterminate={isIndeterminate}
      onChange={(_event, value) => onCheckedChange?.(value)}
      size="small"
      className={cn("shrink-0", className)}
      sx={{ p: 0.25, "& .MuiSvgIcon-root": { fontSize: 18 } }}
      {...props}
    />
  )
}

export { Checkbox }
