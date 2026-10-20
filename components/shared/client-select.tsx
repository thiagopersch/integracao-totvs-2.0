"use client"

import { ColorBadge } from "@/components/shared/color-badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export interface ClientSelectOption {
  id: string
  name: string
  color: string
}

interface ClientSelectProps {
  clients: ClientSelectOption[]
  value: string
  onValueChange: (value: string) => void
  invalid?: boolean
  disabled?: boolean
}

/** Single-client picker showing each client's color badge. */
export function ClientSelect({ clients, value, onValueChange, invalid, disabled }: ClientSelectProps) {
  return (
    <Select
      items={clients.map((c) => ({ value: c.id, label: c.name }))}
      value={value || null}
      onValueChange={(v) => onValueChange(v || "")}
      disabled={disabled}
    >
      <SelectTrigger className="w-full" aria-invalid={invalid}>
        <SelectValue placeholder="Selecione um cliente">
          {(selected: string) => {
            const client = clients.find((c) => c.id === selected)
            return client ? <ColorBadge label={client.name} color={client.color} solid /> : "Selecione um cliente"
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {clients.map((c) => (
          <SelectItem key={c.id} value={c.id}>
            <ColorBadge label={c.name} color={c.color} solid />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
