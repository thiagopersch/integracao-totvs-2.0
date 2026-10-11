"use client"

import { ColorBadge } from "@/components/shared/color-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

export type SelectOptionItem = { value: string; label: string; color?: string }

const EMPTY = "__empty__"

interface OptionSelectProps {
  options: SelectOptionItem[]
  value: string | null | undefined
  onChange: (value: string) => void
  /** When set, adds a first option that maps to "" (e.g. "Todos", "Nenhum", "Automática"). */
  emptyLabel?: string
  placeholder?: string
  id?: string
  className?: string
  disabled?: boolean
  invalid?: boolean
}

/** Base UI Select over a flat option list — options with `color` render as ColorBadge. */
export function OptionSelect({
  options,
  value,
  onChange,
  emptyLabel,
  placeholder = "Selecione",
  id,
  className,
  disabled,
  invalid,
}: OptionSelectProps) {
  const items = [...(emptyLabel ? [{ value: EMPTY, label: emptyLabel }] : []), ...options]
  const render = (option?: SelectOptionItem) =>
    !option ? placeholder : option.color ? <ColorBadge label={option.label} color={option.color} /> : option.label

  return (
    <Select
      items={items.map(({ value, label }) => ({ value, label }))}
      value={value ? value : emptyLabel ? EMPTY : null}
      onValueChange={(v) => onChange(!v || v === EMPTY ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger id={id} className={cn("w-full", className)} aria-invalid={invalid}>
        <SelectValue placeholder={placeholder}>{(v: string) => render(items.find((o) => o.value === v))}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {items.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {render(option)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function toOptions<K extends string>(labels: Record<K, string>, colors?: Record<K, string>): SelectOptionItem[] {
  return (Object.keys(labels) as K[]).map((value) => ({ value, label: labels[value], color: colors?.[value] }))
}
