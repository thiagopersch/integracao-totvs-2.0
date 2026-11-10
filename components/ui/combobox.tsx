"use client"

import * as React from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import { Check } from "lucide-react"

import { cn } from "@/lib/utils"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"
import { VirtualListbox, VIRTUALIZE_OPTIONS_AT } from "@/components/ui/virtual-listbox"

export interface ComboboxItem {
  value: string
  label: string
}

interface ComboboxProps {
  items: ComboboxItem[]
  value: string | null | undefined
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  /** Custom content for an item, used in the list (e.g. a colored badge). Search still matches `label`. */
  renderItem?: (item: ComboboxItem) => React.ReactNode
  "aria-invalid"?: boolean
  id?: string
}

/** Searchable single select (MUI Autocomplete). Lists over 100 options are virtualized. */
export function Combobox({
  items,
  value,
  onValueChange,
  placeholder = "Selecione...",
  emptyText = "Nenhum resultado encontrado.",
  disabled,
  className,
  renderItem,
  id,
  ...props
}: ComboboxProps) {
  // Upstream lists (e.g. a TOTVS report/TBC listing) can legitimately repeat a `value` — dedupe so
  // React never sees two children with the same key, which corrupts selection/rendering.
  const options = React.useMemo(() => {
    const seen = new Set<string>()
    return items.filter((item) => {
      if (seen.has(item.value)) return false
      seen.add(item.value)
      return true
    })
  }, [items])
  const selected = React.useMemo(() => options.find((item) => item.value === value) ?? null, [options, value])
  const virtualize = options.length > VIRTUALIZE_OPTIONS_AT
  const floating = useFloatingLabel(id)

  return (
    <Autocomplete
      id={id ?? floating?.id}
      className={cn("w-full", className)}
      options={options}
      value={selected}
      disabled={disabled}
      onChange={(_event, next) => onValueChange(next?.value ?? "")}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(a, b) => a.value === b.value}
      noOptionsText={emptyText}
      openText="Abrir"
      closeText="Fechar"
      clearText="Limpar"
      autoHighlight
      size="small"
      slots={virtualize ? { listbox: VirtualListbox as React.JSXElementConstructor<React.HTMLAttributes<HTMLElement>> } : undefined}
      renderOption={({ key, ...optionProps }, option, { selected: isSelected }) => (
        <li key={key} {...optionProps} className={cn(optionProps.className, "flex items-center gap-2 text-sm")}>
          <Check className={cn("size-4 shrink-0", isSelected ? "opacity-100" : "opacity-0")} />
          <span className="min-w-0 truncate">{renderItem ? renderItem(option) : option.label}</span>
        </li>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          {...floatingTextFieldProps(floating)}
          placeholder={placeholder}
          error={props["aria-invalid"] === true}
          slotProps={{
            ...params.slotProps,
            ...floatingTextFieldProps(floating, params.slotProps.inputLabel).slotProps,
            htmlInput: { ...params.slotProps.htmlInput, "aria-invalid": props["aria-invalid"] },
          }}
          sx={floating ? undefined : { "& .MuiInputBase-root": { minHeight: 36, py: "0 !important" } }}
        />
      )}
    />
  )
}
