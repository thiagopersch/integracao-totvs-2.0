"use client"

import * as React from "react"
import { ClockIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"

interface TimePickerProps {
  /** "HH:MM" or empty string. */
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  "aria-invalid"?: boolean
  id?: string
  /** Interval, in minutes, between listed quick-select options. */
  step?: number
}

function buildTimeOptions(step: number): string[] {
  const options: string[] = []
  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const h = String(Math.floor(minutes / 60)).padStart(2, "0")
    const m = String(minutes % 60).padStart(2, "0")
    options.push(`${h}:${m}`)
  }
  return options
}

/** Masks free typing into a "HH:MM" shape, clamping hours to 0-23 and minutes to 0-59 as digits complete. */
function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4)
  if (digits.length <= 2) {
    if (digits.length === 2 && Number(digits) > 23) return "23"
    return digits
  }
  let hours = digits.slice(0, 2)
  if (Number(hours) > 23) hours = "23"
  let minutes = digits.slice(2)
  if (minutes.length === 2 && Number(minutes) > 59) minutes = "59"
  return `${hours}:${minutes}`
}

export function TimePicker({
  value,
  onValueChange,
  placeholder = "HH:MM",
  className,
  disabled,
  id,
  step = 15,
  ...props
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const options = React.useMemo(() => buildTimeOptions(step), [step])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <InputGroup className={cn(className)}>
        <InputGroupInput
          id={id}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          aria-invalid={props["aria-invalid"]}
          onChange={(e) => onValueChange(maskTimeInput(e.target.value))}
          onBlur={(e) => {
            const digits = e.target.value.replace(/\D/g, "")
            if (digits.length > 0 && digits.length < 3) onValueChange(maskTimeInput(digits.padEnd(2, "0") + "00"))
          }}
        />
        <InputGroupAddon align="inline-end">
          <PopoverTrigger
            disabled={disabled}
            render={<InputGroupButton type="button" variant="ghost" size="icon-sm" aria-label="Selecionar horário" />}
          >
            <ClockIcon className="h-4 w-4" />
          </PopoverTrigger>
        </InputGroupAddon>
      </InputGroup>
      <PopoverContent className="w-40 p-0" align="end">
        <Command>
          <CommandInput placeholder="Buscar horário..." />
          <CommandList>
            <CommandEmpty>Nenhum horário encontrado.</CommandEmpty>
            <CommandGroup>
              {options.map((time) => (
                <CommandItem
                  key={time}
                  value={time}
                  data-checked={time === value}
                  onSelect={() => {
                    onValueChange(time)
                    setOpen(false)
                  }}
                >
                  {time}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
