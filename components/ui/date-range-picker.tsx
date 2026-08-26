"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import type { DateRange } from "react-day-picker"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface DateRangePickerProps {
  value: DateRange | undefined
  onValueChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

export function DateRangePicker({
  value,
  onValueChange,
  placeholder = "Selecione um período",
  className,
  disabled,
}: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)

  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd/MM/yyyy")} - ${format(value.to, "dd/MM/yyyy")}`
      : format(value.from, "dd/MM/yyyy")
    : placeholder

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            className={cn("w-full justify-start font-normal", !value?.from && "text-muted-foreground", className)}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="range"
          selected={value}
          onSelect={onValueChange}
          numberOfMonths={2}
          locale={ptBR}
          defaultMonth={value?.from}
        />
      </PopoverContent>
    </Popover>
  )
}
