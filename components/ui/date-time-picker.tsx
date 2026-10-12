"use client"

import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  /** "yyyy-MM-ddTHH:mm" or "" (local wall time, no timezone). */
  value: string
  onValueChange: (value: string) => void
  id?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
}

/**
 * Date + time side by side. A date without time keeps the date and defaults the time to 00:00 only
 * when the user picks one; clearing the date clears the whole value.
 */
export function DateTimePicker({ value, onValueChange, id, disabled, className, ...props }: DateTimePickerProps) {
  const [date = "", time = ""] = value ? value.split("T") : []
  return (
    <div className={cn("grid grid-cols-[1fr_110px] gap-2", className)}>
      <DatePicker
        id={id}
        value={date}
        disabled={disabled}
        aria-invalid={props["aria-invalid"]}
        onValueChange={(d) => onValueChange(d ? `${d}T${time || "00:00"}` : "")}
      />
      <TimePicker
        value={time}
        disabled={disabled || !date}
        aria-invalid={props["aria-invalid"]}
        onValueChange={(t) => date && onValueChange(`${date}T${t || "00:00"}`)}
      />
    </div>
  )
}
