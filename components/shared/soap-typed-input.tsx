"use client"

import { useRef } from "react"
import { Paperclip, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  fieldInputKind,
  fieldValueError,
  fromDateTimeInputValue,
  sanitizeFieldValue,
  toDateInputValue,
  toDateTimeInputValue,
  type FieldInputMeta,
} from "@/utils/soap-field-input"

const EMPTY = "__empty__"
const FLAG_OPTIONS = [
  { value: EMPTY, label: "—" },
  { value: "T", label: "T — Sim" },
  { value: "F", label: "F — Não" },
]
const BOOLEAN_OPTIONS = [
  { value: EMPTY, label: "—" },
  { value: "true", label: "true — Sim" },
  { value: "false", label: "false — Não" },
]

interface SoapTypedInputProps {
  id: string
  meta: FieldInputMeta
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

/** One GetSchema field as the input that only accepts what TOTVS accepts for its type. */
export function SoapTypedInput({ id, meta, value, onChange, disabled }: SoapTypedInputProps) {
  const kind = fieldInputKind(meta)
  const error = fieldValueError(kind, meta.type, value)
  const placeholder = meta.defaultValue ? `Padrão: ${meta.defaultValue}` : undefined
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File | undefined) {
    if (!file) return
    const reader = new FileReader()
    // data:<mime>;base64,<payload> — TOTVS only wants the payload.
    reader.onload = () => onChange(String(reader.result ?? "").replace(/^data:[^,]*,/, ""))
    reader.readAsDataURL(file)
  }

  let input: React.ReactNode
  if (kind === "flag" || kind === "boolean") {
    const options = kind === "flag" ? FLAG_OPTIONS : BOOLEAN_OPTIONS
    input = (
      <Select
        items={options}
        value={value || EMPTY}
        onValueChange={(v) => onChange(!v || v === EMPTY ? "" : v)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="w-full" aria-invalid={!!error}>
          <SelectValue placeholder={placeholder ?? "—"} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else if (kind === "datetime") {
    input = (
      <Input
        id={id}
        type="datetime-local"
        step={1}
        value={toDateTimeInputValue(value)}
        onChange={(e) => onChange(fromDateTimeInputValue(e.target.value))}
        disabled={disabled}
      />
    )
  } else if (kind === "date") {
    input = <Input id={id} type="date" value={toDateInputValue(value)} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  } else if (kind === "time") {
    input = <Input id={id} type="time" step={1} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} />
  } else if (kind === "binary") {
    input = (
      <div className="flex items-center gap-2">
        <input ref={fileRef} type="file" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
        <Button type="button" variant="outline" size="sm" className="min-w-0 flex-1 justify-start" onClick={() => fileRef.current?.click()} disabled={disabled}>
          <Paperclip className="h-4 w-4 mr-2 shrink-0" />
          <span className="truncate">{value ? `Arquivo carregado (${Math.round((value.length * 3) / 4 / 1024)} KB)` : "Selecionar arquivo"}</span>
        </Button>
        {value && (
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onChange("")} title="Remover arquivo" disabled={disabled}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  } else if (kind === "longText") {
    input = (
      <Textarea
        id={id}
        rows={2}
        value={value}
        maxLength={meta.maxLength ? Number(meta.maxLength) : undefined}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
    )
  } else {
    input = (
      <Input
        id={id}
        value={value}
        inputMode={kind === "integer" ? "numeric" : kind === "decimal" ? "decimal" : undefined}
        maxLength={kind === "text" && meta.maxLength ? Number(meta.maxLength) : undefined}
        onChange={(e) => onChange(sanitizeFieldValue(kind, e.target.value))}
        placeholder={placeholder}
        aria-invalid={!!error}
        disabled={disabled}
      />
    )
  }

  return (
    <>
      {input}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </>
  )
}
