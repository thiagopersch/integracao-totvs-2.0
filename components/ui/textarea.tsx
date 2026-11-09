"use client"

import * as React from "react"
import OutlinedInput from "@mui/material/OutlinedInput"

import { cn } from "@/lib/utils"
import { splitInputClasses } from "@/components/ui/input"

/** Multi-line text field (MUI OutlinedInput). `ref` reaches the native <textarea> for react-hook-form. */
function Textarea({ className, ref, rows = 3, style, disabled, ...props }: React.ComponentProps<"textarea">) {
  const { inner, outer } = splitInputClasses(className)
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return (
    <OutlinedInput
      data-slot="textarea"
      multiline
      rows={rows}
      inputRef={ref}
      disabled={disabled}
      error={invalid}
      className={cn("w-full text-sm", outer)}
      style={style}
      inputProps={{ ...props, className: cn("min-h-16 resize-y px-2.5 py-2 placeholder:text-muted-foreground", inner) } as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
      sx={{ p: 0, alignItems: "stretch" }}
    />
  )
}

export { Textarea }
