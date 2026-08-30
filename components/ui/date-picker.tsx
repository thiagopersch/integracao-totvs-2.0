"use client"

import * as React from "react"
import { CalendarIcon } from "lucide-react"
import { format, parseISO } from "date-fns"
import { ptBR } from "date-fns/locale"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

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

export function DatePicker({
  value,
  onValueChange,
  placeholder = "Selecione uma data",
  className,
  disabled,
  id,
  ...props
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)
  const selected = value ? parseISO(value) : undefined

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            aria-invalid={props["aria-invalid"]}
            className={cn("w-full justify-start font-normal", !selected && "text-muted-foreground", className)}
          />
        }
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="truncate">{selected ? format(selected, "dd/MM/yyyy") : placeholder}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(date) => {
            onValueChange(date ? format(date, "yyyy-MM-dd") : "")
            setOpen(false)
          }}
          locale={ptBR}
          defaultMonth={selected}
        />
      </PopoverContent>
    </Popover>
  )
}
