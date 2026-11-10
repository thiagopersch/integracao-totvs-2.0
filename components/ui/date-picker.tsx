"use client"

import * as React from "react"
import { DatePicker as MuiDatePicker } from "@mui/x-date-pickers/DatePicker"
import { format, isValid, parseISO } from "date-fns"

import { cn } from "@/lib/utils"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"

interface DatePickerProps {
  /** ISO date string (yyyy-MM-dd) or empty string, mirroring a native `type="date"` input value. */
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  id?: string
}

/** MUI X DatePicker (pt-BR, dd/MM/yyyy, clearable) keeping the old ISO-string API. */
export function DatePicker({ value, onValueChange, className, disabled, id, ...props }: DatePickerProps) {
  const floating = useFloatingLabel(id)
  const parsed = value ? parseISO(value) : null
  return (
    <MuiDatePicker
      value={parsed && isValid(parsed) ? parsed : null}
      onChange={(next) => {
        if (next === null) onValueChange("")
        else if (isValid(next)) onValueChange(format(next, "yyyy-MM-dd"))
      }}
      disabled={disabled}
      className={cn("w-full", className)}
      slotProps={{
        textField: { id: id ?? floating?.id, size: "small", fullWidth: true, error: props["aria-invalid"] === true, ...floatingTextFieldProps(floating) },
        field: { clearable: true },
      }}
    />
  )
}
