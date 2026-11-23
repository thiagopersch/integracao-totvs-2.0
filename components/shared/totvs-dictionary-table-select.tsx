"use client"

import * as React from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import { searchDictionaryTables } from "@/actions/totvs-dictionary"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"

type TableOption = { table: string; description: string | null }

interface TotvsDictionaryTableSelectProps {
  id?: string
  value: string
  onChange: (table: string) => void
  /** Accept a table name that is not in the dictionary yet (new-entry form). */
  freeSolo?: boolean
  placeholder?: string
  disabled?: boolean
  "aria-invalid"?: boolean
}

/** Table-name picker backed by the dictionary itself (server search, debounced). */
export function TotvsDictionaryTableSelect({ id, value, onChange, freeSolo, placeholder = "Ex: SCURSO", disabled, ...props }: TotvsDictionaryTableSelectProps) {
  const floating = useFloatingLabel(id)
  const [input, setInput] = React.useState(value)
  const [options, setOptions] = React.useState<TableOption[]>([])
  const [loading, setLoading] = React.useState(false)

  // Follow outside changes of `value` (form reset, "Limpar" in the filter) — adjusted during render.
  const [lastValue, setLastValue] = React.useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setInput(value)
  }

  React.useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const res = await searchDictionaryTables(input)
      if (!cancelled) {
        setOptions(res.tables)
        setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [input])

  return (
    <Autocomplete<TableOption | string, false, false, boolean>
      id={id ?? floating?.id}
      className="w-full"
      freeSolo={freeSolo}
      options={options}
      loading={loading}
      disabled={disabled}
      filterOptions={(x) => x}
      value={value || null}
      inputValue={input}
      onInputChange={(_e, next, reason) => {
        setInput(next.toUpperCase())
        if (freeSolo && reason === "input") onChange(next.toUpperCase())
        if (reason === "clear") onChange("")
      }}
      onChange={(_e, next) => onChange(typeof next === "string" ? next.toUpperCase() : (next?.table ?? ""))}
      getOptionLabel={(o) => (typeof o === "string" ? o : o.table)}
      isOptionEqualToValue={(a, b) => (typeof a === "string" ? a : a.table) === (typeof b === "string" ? b : b.table)}
      noOptionsText="Nenhuma tabela encontrada"
      loadingText="Buscando…"
      openText="Abrir"
      closeText="Fechar"
      clearText="Limpar"
      size="small"
      renderOption={({ key, ...optionProps }, option) => {
        const o = typeof option === "string" ? { table: option, description: null } : option
        return (
          <li key={key} {...optionProps} className={`${optionProps.className ?? ""} flex flex-col !items-start text-sm`}>
            <span className="font-mono">{o.table}</span>
            {o.description && <span className="text-xs text-muted-foreground">{o.description}</span>}
          </li>
        )
      }}
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
