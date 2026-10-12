"use client"

import { Input } from "@/components/ui/input"
import { formatDecimal, onlyDigits } from "@/lib/masks"
import { cn } from "@/lib/utils"

interface CurrencyInputProps {
  /** Value in reais (e.g. 1234.5), or null when empty. */
  value: number | null | undefined
  onValueChange: (value: number | null) => void
  id?: string
  placeholder?: string
  disabled?: boolean
  className?: string
  "aria-invalid"?: boolean
  onBlur?: () => void
}

/**
 * Money input with the R$ mask ("R$ 1.234,56"): typing fills cents from the right, like the
 * hourly-rate/contracted-hours inputs (lib/masks formatDecimal). Emits a number in reais; clearing
 * every digit emits null.
 */
export function CurrencyInput({ value, onValueChange, id, placeholder = "0,00", disabled, className, onBlur, ...props }: CurrencyInputProps) {
  const display = value === null || value === undefined ? "" : formatDecimal(String(Math.round(value * 100)))
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
      <Input
        id={id}
        inputMode="numeric"
        className="pl-9 text-right tabular-nums"
        value={display}
        placeholder={placeholder}
        disabled={disabled}
        onBlur={onBlur}
        onChange={(e) => {
          const digits = onlyDigits(e.target.value)
          onValueChange(digits ? Number(digits) / 100 : null)
        }}
        aria-invalid={props["aria-invalid"]}
      />
    </div>
  )
}
