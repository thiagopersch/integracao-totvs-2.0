"use client"

import * as React from "react"
import OutlinedInput from "@mui/material/OutlinedInput"

import { cn } from "@/lib/utils"
import { useFloatingLabel } from "@/components/ui/field"
import { FloatingInput, splitInputClasses } from "@/components/ui/input"

/**
 * Multi-line text field (MUI OutlinedInput). `ref` reaches the native <textarea> for react-hook-form.
 * Inside a vertical <Field> the <FieldLabel> becomes its floating outlined label.
 */
function Textarea({ className, ref, rows = 3, style, disabled, ...props }: React.ComponentProps<"textarea">) {
  const floating = useFloatingLabel(props.id)
  if (floating) {
    return (
      <FloatingInput
        {...(props as Omit<React.ComponentProps<typeof FloatingInput>, "floating">)}
        floating={floating}
        multiline
        rows={rows}
        className={className}
        style={style}
        disabled={disabled}
        ref={ref as unknown as React.Ref<HTMLInputElement>}
      />
    )
  }
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
      inputProps={{ ...props, className: cn("min-h-16 resize-y px-3 py-2 placeholder:text-muted-foreground", inner) } as React.TextareaHTMLAttributes<HTMLTextAreaElement>}
      sx={{ p: 0, alignItems: "stretch" }}
    />
  )
}

export { Textarea }
