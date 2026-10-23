"use client"

import * as React from "react"
import { ChevronsUpDown, X } from "lucide-react"
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { getBadgeTextColor } from "@/lib/colors"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
  /** Overrides how the item renders in the dropdown list (e.g. a colored badge next to the value); `label` still drives search matching and the selected-chip text. */
  render?: React.ReactNode
  /** Tints the dropdown item and the selected chip like `ColorBadge` (e.g. a tag's color). Ignored when `render` is set. */
  color?: string
  /** Dropdown section heading the item is listed under (e.g. a requester's client); items without one go in an untitled section. */
  group?: string
}

function colorBadgeStyle(color: string, isDarkTheme: boolean): React.CSSProperties {
  return { backgroundColor: `${color}22`, borderColor: color, color: getBadgeTextColor(color, isDarkTheme) }
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
  /** Selected chips shown in the trigger before collapsing the rest into a "+N" chip; all shown when unset. */
  maxVisible?: number
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
  maxVisible,
}: MultiSelectProps) {
  const { resolvedTheme } = useTheme()
  const isDarkTheme = resolvedTheme === "dark"
  const [open, setOpen] = React.useState(false)
  const selected = items.filter((item) => value.includes(item.value))
  const visibleSelected = maxVisible === undefined ? selected : selected.slice(0, maxVisible)
  const hiddenCount = selected.length - visibleSelected.length
  const groups = React.useMemo(() => {
    const byGroup = new Map<string, MultiSelectItem[]>()
    for (const item of items) {
      const key = item.group ?? ""
      byGroup.set(key, [...(byGroup.get(key) ?? []), item])
    }
    return [...byGroup]
  }, [items])

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
            visibleSelected.map((item) => (
              <Badge
                key={item.value}
                variant={item.color ? "outline" : "secondary"}
                style={item.color ? colorBadgeStyle(item.color, isDarkTheme) : undefined}
                className="h-auto max-w-full gap-1 overflow-visible whitespace-normal break-words"
                onClick={(e) => {
                  e.stopPropagation()
                  toggle(item.value)
                }}
              >
                <span className="break-words">{item.label}</span>
                <X className="h-3 w-3 shrink-0 cursor-pointer" />
              </Badge>
            ))
          )}
          {hiddenCount > 0 && <Badge variant="secondary">+{hiddenCount}</Badge>}
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="min-w-(--anchor-width) w-max max-w-(--available-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(([group, groupItems]) => (
              <CommandGroup key={group} heading={group || undefined}>
                {groupItems.map((item) => {
                  const isSelected = value.includes(item.value)
                  return (
                    <CommandItem
                      key={item.value}
                      value={`${item.label} ${item.group ?? ""}`}
                      onSelect={() => toggle(item.value)}
                    >
                      <Checkbox checked={isSelected} className="pointer-events-none mr-2" />
                      {item.render ?? (item.color ? <Badge variant="outline" style={colorBadgeStyle(item.color, isDarkTheme)}>{item.label}</Badge> : item.label)}
                    </CommandItem>
                  )
                })}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
