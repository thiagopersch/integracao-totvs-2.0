"use client"

import * as React from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import Chip from "@mui/material/Chip"

import { useAppTheme } from "@/hooks/use-app-theme"
import { cn } from "@/lib/utils"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"
import { getBadgeTextColor } from "@/lib/colors"
import { Checkbox } from "@/components/ui/checkbox"
import { VirtualListbox, VIRTUALIZE_OPTIONS_AT } from "@/components/ui/virtual-listbox"

export interface MultiSelectItem {
  value: string
  label: string
  /** Overrides how the item renders in the dropdown list; `label` still drives search and the chip text. */
  render?: React.ReactNode
  /** Tints the dropdown item and the selected chip like `ColorBadge` (e.g. a tag's color). Ignored when `render` is set. */
  color?: string
  /** Dropdown section heading the item is listed under (e.g. a requester's client). */
  group?: string
}

function colorChipStyle(color: string, isDarkTheme: boolean): React.CSSProperties {
  return { backgroundColor: `${color}22`, borderColor: color, color: getBadgeTextColor(color, isDarkTheme), borderWidth: 1, borderStyle: "solid" }
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
  /** Selected chips shown before collapsing the rest into a "+N" chip; all shown when unset. */
  maxVisible?: number
}

/** Searchable multi select with chips (MUI Autocomplete `multiple`). Big ungrouped lists are virtualized. */
export function MultiSelect({
  items,
  value,
  onValueChange,
  placeholder = "Selecione...",
  emptyText = "Nenhum resultado encontrado.",
  disabled,
  className,
  maxVisible,
}: MultiSelectProps) {
  const { resolvedTheme } = useAppTheme()
  const floating = useFloatingLabel()
  const isDarkTheme = resolvedTheme === "dark"
  const byValue = React.useMemo(() => new Map(items.map((item) => [item.value, item])), [items])
  const selected = React.useMemo(() => value.map((v) => byValue.get(v)).filter((x): x is MultiSelectItem => Boolean(x)), [value, byValue])
  // Grouped options must stay contiguous for MUI's groupBy; sort is stable so order within a group is kept.
  const hasGroups = items.some((item) => item.group)
  const options = React.useMemo(
    () => (hasGroups ? [...items].sort((a, b) => (a.group ?? "").localeCompare(b.group ?? "")) : items),
    [items, hasGroups]
  )
  const virtualize = !hasGroups && options.length > VIRTUALIZE_OPTIONS_AT

  return (
    <Autocomplete
      multiple
      disableCloseOnSelect
      className={cn("w-full", className)}
      options={options}
      value={selected}
      disabled={disabled}
      onChange={(_event, next) => onValueChange(next.map((item) => item.value))}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      groupBy={hasGroups ? (option) => option.group ?? "" : undefined}
      filterOptions={(opts, state) => {
        const q = state.inputValue.trim().toLowerCase()
        return q ? opts.filter((o) => `${o.label} ${o.group ?? ""}`.toLowerCase().includes(q)) : opts
      }}
      noOptionsText={emptyText}
      limitTags={maxVisible}
      getLimitTagsText={(more) => `+${more}`}
      size="small"
      slots={virtualize ? { listbox: VirtualListbox as React.JSXElementConstructor<React.HTMLAttributes<HTMLElement>> } : undefined}
      renderOption={({ key, ...optionProps }, option, { selected: isSelected }) => (
        <li key={key} {...optionProps} className={cn(optionProps.className, "flex items-center gap-2 text-sm")}>
          <Checkbox checked={isSelected} className="pointer-events-none" tabIndex={-1} />
          {option.render ?? (option.color ? <Chip label={option.label} size="small" style={colorChipStyle(option.color, isDarkTheme)} /> : option.label)}
        </li>
      )}
      renderValue={(tags, getItemProps) =>
        tags.map((option, index) => {
          const { key, ...itemProps } = getItemProps({ index })
          return <Chip key={key} label={option.label} size="small" {...itemProps} style={option.color ? colorChipStyle(option.color, isDarkTheme) : undefined} />
        })
      }
      renderInput={(params) => (
        <TextField
          {...params}
          {...floatingTextFieldProps(floating)}
          slotProps={{ ...params.slotProps, ...floatingTextFieldProps(floating, params.slotProps.inputLabel).slotProps }}
          placeholder={selected.length === 0 ? placeholder : undefined}
          sx={floating ? undefined : { "& .MuiInputBase-root": { minHeight: 36, py: "2px !important" } }}
        />
      )}
    />
  )
}
