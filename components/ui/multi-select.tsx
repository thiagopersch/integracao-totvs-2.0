"use client"

import * as React from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface MultiSelectItem {
  value: string
  label: string
}

interface MultiSelectProps {
  items: MultiSelectItem[]
  value: string[]
  onValueChange: (value: string[]) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
}

export function MultiSelect({
  items,
  value,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyText = "Nenhum resultado encontrado.",
  disabled,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false)
  const selected = items.filter((item) => value.includes(item.value))

  function toggle(itemValue: string) {
    onValueChange(
      value.includes(itemValue) ? value.filter((v) => v !== itemValue) : [...value, itemValue]
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("h-auto min-h-8 w-full justify-between font-normal", className)}
          />
        }
      >
        <div className="flex flex-1 flex-wrap items-center gap-1">
          {selected.length === 0 ? (
            <span className="text-muted-foreground">{placeholder}</span>
          ) : (
            selected.map((item) => (
              <Badge
                key={item.value}
                variant="secondary"
                className="gap-1"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(item.value)
                }}
              >
                {item.label}
                <X className="h-3 w-3 cursor-pointer" />
              </Badge>
            ))
          )}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {items.map((item) => {
                const isSelected = value.includes(item.value)
                return (
                  <CommandItem
                    key={item.value}
                    value={item.label}
                    onSelect={() => toggle(item.value)}
                  >
                    <Check className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    {item.label}
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
