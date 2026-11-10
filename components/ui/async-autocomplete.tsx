"use client"

import * as React from "react"
import Autocomplete from "@mui/material/Autocomplete"
import TextField from "@mui/material/TextField"
import Skeleton from "@mui/material/Skeleton"

import { cn } from "@/lib/utils"
import { floatingTextFieldProps, useFloatingLabel } from "@/components/ui/field"

/** Entities served by GET /api/lookup/[entity] (paginated, permission-scoped on the server). */
export type LookupEntity = "clients" | "requesters" | "analysts" | "departments" | "demand-types" | "tags" | "projects" | "demands"

export type LookupItem = { id: string; label: string; color?: string }
type LookupPage = { items: LookupItem[]; nextCursor: string | null }

const DEBOUNCE_MS = 300
const PAGE_SIZE = 30

async function fetchLookup(entity: LookupEntity, params: Record<string, string>, signal?: AbortSignal): Promise<LookupPage> {
  const qs = new URLSearchParams({ limit: String(PAGE_SIZE), ...params })
  const response = await fetch(`/api/lookup/${entity}?${qs}`, { signal })
  if (!response.ok) throw new Error(`lookup ${entity}: ${response.status}`)
  return response.json()
}

type BaseProps = {
  entity: LookupEntity
  placeholder?: string
  disabled?: boolean
  className?: string
  id?: string
  /** Characters typed before the server is queried (0 = list the first page on open). */
  minChars?: number
  "aria-invalid"?: boolean
}

type SingleProps = BaseProps & { multiple?: false; value: string | null; onValueChange: (value: string) => void }
type MultipleProps = BaseProps & { multiple: true; value: string[]; onValueChange: (value: string[]) => void }

/**
 * Searchable select over a large entity, fetched page by page from /api/lookup: 300 ms debounce,
 * the previous request aborted on each keystroke, skeleton options while loading, next page on
 * scroll to the end. Selected ids are resolved to labels with `?ids=`.
 */
export function AsyncAutocomplete(props: SingleProps | MultipleProps) {
  const { entity, placeholder = "Buscar...", disabled, className, id, minChars = 0 } = props
  const floating = useFloatingLabel(id)
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [query, setQuery] = React.useState("")
  const [options, setOptions] = React.useState<LookupItem[]>([])
  const [cursor, setCursor] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [selectedItems, setSelectedItems] = React.useState<LookupItem[]>([])
  const abortRef = React.useRef<AbortController | null>(null)

  const selectedIds = React.useMemo(
    () => (props.multiple ? props.value : props.value ? [props.value] : []),
    [props.multiple, props.value]
  )

  // Resolve labels of ids we don't know yet (initial value, value set from outside).
  const idsKey = selectedIds.join(",")
  React.useEffect(() => {
    const missing = selectedIds.filter((v) => !selectedItems.some((item) => item.id === v))
    if (!missing.length) return
    const controller = new AbortController()
    fetchLookup(entity, { ids: missing.join(",") }, controller.signal)
      .then((page) => setSelectedItems((prev) => [...prev.filter((p) => !page.items.some((i) => i.id === p.id)), ...page.items]))
      .catch(() => {})
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the ids string
  }, [entity, idsKey])

  // Debounce the typed text into `query`.
  React.useEffect(() => {
    const timer = setTimeout(() => setQuery(input.trim()), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [input])

  const load = React.useCallback(
    (q: string, after: string | null) => {
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller
      setLoading(true)
      fetchLookup(entity, { q, ...(after ? { cursor: after } : {}) }, controller.signal)
        .then((page) => {
          setOptions((prev) => (after ? [...prev, ...page.items] : page.items))
          setCursor(page.nextCursor)
          setLoading(false)
        })
        .catch((error: Error) => {
          if (error.name !== "AbortError") setLoading(false)
        })
    },
    [entity]
  )

  React.useEffect(() => {
    if (!open || query.length < minChars) return
    // Deferred a tick so the fetch starts outside the effect body (no synchronous setState there).
    const timer = setTimeout(() => load(query, null), 0)
    return () => {
      clearTimeout(timer)
      abortRef.current?.abort()
    }
  }, [open, query, minChars, load])

  const byId = (value: string) => selectedItems.find((i) => i.id === value) ?? options.find((i) => i.id === value) ?? { id: value, label: "…" }
  const value = props.multiple ? props.value.map(byId) : props.value ? byId(props.value) : null

  return (
    <Autocomplete<LookupItem, boolean>
      id={id}
      multiple={props.multiple}
      className={cn("w-full", className)}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      disabled={disabled}
      options={options}
      value={value as LookupItem & LookupItem[]}
      filterOptions={(x) => x}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(a, b) => a.id === b.id}
      inputValue={input}
      onInputChange={(_event, next, reason) => reason !== "reset" && setInput(next)}
      onChange={(_event, next) => {
        const items = (Array.isArray(next) ? next : next ? [next] : []) as LookupItem[]
        setSelectedItems((prev) => [...prev, ...items.filter((i) => !prev.some((p) => p.id === i.id))])
        if (props.multiple) props.onValueChange(items.map((i) => i.id))
        else props.onValueChange(items[0]?.id ?? "")
      }}
      loading={loading}
      loadingText={
        <div className="space-y-2" role="status" aria-label="Carregando">
          <Skeleton height={20} />
          <Skeleton height={20} />
          <Skeleton height={20} width="70%" />
        </div>
      }
      noOptionsText={query.length < minChars ? `Digite ao menos ${minChars} caractere(s)` : "Nenhum resultado encontrado."}
      slotProps={{
        listbox: {
          onScroll: (event: React.UIEvent<HTMLElement>) => {
            const el = event.currentTarget
            if (cursor && !loading && el.scrollTop + el.clientHeight >= el.scrollHeight - 40) load(query, cursor)
          },
        },
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          {...floatingTextFieldProps(floating)}
          slotProps={{ ...params.slotProps, ...floatingTextFieldProps(floating, params.slotProps.inputLabel).slotProps }}
          placeholder={placeholder}
          error={props["aria-invalid"] === true}
          sx={floating ? undefined : { "& .MuiInputBase-root": { minHeight: 36, py: "2px !important" } }}
        />
      )}
    />
  )
}
