"use client"

import * as React from "react"
import { TimePicker as MuiTimePicker } from "@mui/x-date-pickers/TimePicker"
import { format, isValid, parse } from "date-fns"

import { cn } from "@/lib/utils"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"

interface TimePickerProps {
  /** "HH:mm" or "". */
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  id?: string
  /** Minutes between the options in the list. */
  step?: number
}

const BASE = new Date(2000, 0, 1)

/** MUI X TimePicker (24h, typing or list) keeping the old "HH:mm" string API. */
export function TimePicker({ value, onValueChange, className, disabled, id, step = 15, ...props }: TimePickerProps) {
  const floating = useFloatingLabel(id)
  const parsed = value ? parse(value, "HH:mm", BASE) : null
  return (
    <MuiTimePicker
      value={parsed && isValid(parsed) ? parsed : null}
      onChange={(next) => {
        if (next === null) onValueChange("")
        else if (isValid(next)) onValueChange(format(next, "HH:mm"))
      }}
      ampm={false}
      timeSteps={{ minutes: step }}
      disabled={disabled}
      className={cn("w-full", className)}
      slotProps={{
        textField: { id: id ?? floating?.id, size: "small", fullWidth: true, error: props["aria-invalid"] === true, ...floatingTextFieldProps(floating) },
        field: { clearable: true },
      }}
    />
  )
}
