"use client"

import * as React from "react"
import OutlinedInput from "@mui/material/OutlinedInput"
import InputBase from "@mui/material/InputBase"

import { cn } from "@/lib/utils"

// Classes that style the text itself (padding, font, alignment…) go on the native <input>/<textarea>;
// the rest (width, height, margin, border, background…) on the MUI root.
const INNER = /^(?:[a-z-]+:)*(?:p[lrxytb]?-|text-(?:left|right|center|xs|sm|base|lg|\[)|font-|tracking-|tabular-nums|uppercase|lowercase|placeholder:|resize|min-h-|max-h-|leading-|field-sizing|caret-|selection:|file:|truncate|indent-)/

export function splitInputClasses(className?: string) {
  const inner: string[] = []
  const outer: string[] = []
  for (const token of (className ?? "").split(/\s+/).filter(Boolean)) (INNER.test(token) ? inner : outer).push(token)
  return { inner: inner.join(" "), outer: outer.join(" ") }
}

type NativeInputProps = Omit<React.ComponentProps<"input">, "size" | "color">

/**
 * Text input (MUI OutlinedInput). The `ref` reaches the native <input>, so react-hook-form's
 * `register()` keeps working; every native attribute goes to the <input> as well.
 */
function Input({ className, type, ref, style, disabled, ...props }: NativeInputProps) {
  const { inner, outer } = splitInputClasses(className)
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return (
    <OutlinedInput
      data-slot="input"
      type={type}
      inputRef={ref}
      disabled={disabled}
      error={invalid}
      className={cn("h-8 w-full min-w-0 text-sm", outer)}
      style={style}
      inputProps={{ ...props, className: cn("px-2.5 py-1 placeholder:text-muted-foreground", inner) } as React.InputHTMLAttributes<HTMLInputElement>}
      sx={{ "& .MuiOutlinedInput-input": { height: "100%", boxSizing: "border-box" }, "&.Mui-disabled": { bgcolor: "action.disabledBackground" } }}
    />
  )
}

/** Borderless input for compound controls (InputGroup). */
function BareInput({ className, type, ref, style, disabled, ...props }: NativeInputProps) {
  const { inner, outer } = splitInputClasses(className)
  return (
    <InputBase
      type={type}
      inputRef={ref}
      disabled={disabled}
      className={cn("h-full w-full min-w-0 flex-1 text-sm", outer)}
      style={style}
      inputProps={{ ...props, className: cn("px-2.5 py-1 placeholder:text-muted-foreground", inner) } as React.InputHTMLAttributes<HTMLInputElement>}
      sx={{ "& .MuiInputBase-input": { height: "100%", boxSizing: "border-box" } }}
    />
  )
}

export { BareInput, Input }
