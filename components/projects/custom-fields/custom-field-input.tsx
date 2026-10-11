"use client"

import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorBadge } from "@/components/shared/color-badge"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import type { CustomFieldDef, CustomFieldValue, CustomFieldValues } from "@/lib/custom-fields"

export type PickerUser = { id: string; name: string }

interface CustomFieldInputProps {
  def: CustomFieldDef
  value: CustomFieldValue | undefined
  onChange: (value: CustomFieldValue) => void
  users?: PickerUser[]
  invalid?: boolean
}

const NONE = "__none__"

export function CustomFieldInput({ def, value, onChange, users = [], invalid }: CustomFieldInputProps) {
  const id = `cf-${def.id}`
  const options = def.options ?? []

  switch (def.type) {
    case "LONG_TEXT":
      return <Textarea id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />
    case "NUMBER":
    case "CURRENCY":
      return (
        <Input
          id={id}
          type="number"
          step={def.type === "CURRENCY" ? "0.01" : "any"}
          inputMode="decimal"
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder={def.type === "CURRENCY" ? "0,00" : undefined}
          aria-invalid={invalid}
        />
      )
    case "DATE":
      return <DatePicker id={id} value={(value as string) ?? ""} onValueChange={(v) => onChange(v || null)} aria-invalid={invalid} />
    case "SELECT":
      return (
        <Select
          items={[{ value: NONE, label: "—" }, ...options.map((o) => ({ value: o.id, label: o.label }))]}
          value={(value as string) || NONE}
          onValueChange={(v) => onChange(!v || v === NONE ? null : v)}
        >
          <SelectTrigger id={id} className="w-full" aria-invalid={invalid}>
            <SelectValue>
              {(v: string) => {
                const option = options.find((o) => o.id === v)
                return option ? <ColorBadge label={option.label} color={option.color || "#6b7280"} /> : "—"
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {options.map((o) => (
              <SelectItem key={o.id} value={o.id}>
                <ColorBadge label={o.label} color={o.color || "#6b7280"} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    case "MULTISELECT":
      return (
        <MultiSelect
          items={options.map((o) => ({ value: o.id, label: o.label, color: o.color || undefined }))}
          value={Array.isArray(value) ? value : []}
          onValueChange={(v) => onChange(v)}
        />
      )
    case "BOOLEAN":
      return <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
    case "USER":
      return (
        <Combobox
          items={[{ value: NONE, label: "—" }, ...users.map((u) => ({ value: u.id, label: u.name }))]}
          value={(value as string) || NONE}
          onValueChange={(v) => onChange(!v || v === NONE ? null : v)}
          placeholder="Selecione um usuário"
          aria-invalid={invalid}
        />
      )
    case "URL":
      return <Input id={id} type="url" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="https://" aria-invalid={invalid} />
    default:
      return <Input id={id} value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} aria-invalid={invalid} />
  }
}

interface CustomFieldsFormSectionProps {
  defs: CustomFieldDef[]
  values: CustomFieldValues
  onChange: (id: string, value: CustomFieldValue) => void
  errors?: Record<string, { message?: string } | undefined>
  users?: PickerUser[]
}

/** Renders every active definition in order — values keyed by definition id. */
export function CustomFieldsFormSection({ defs, values, onChange, errors, users }: CustomFieldsFormSectionProps) {
  if (defs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhum campo personalizado ativo. Crie campos em Projetos → Campos personalizados.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {defs.map((def) => (
        <Field
          key={def.id}
          orientation={def.type === "BOOLEAN" ? "horizontal" : undefined}
          className={def.type === "LONG_TEXT" || def.type === "MULTISELECT" ? "sm:col-span-2" : undefined}
        >
          {def.type === "BOOLEAN" && (
            <CustomFieldInput def={def} value={values[def.id]} onChange={(v) => onChange(def.id, v)} users={users} />
          )}
          <div className="flex flex-col gap-1">
            <FieldLabel htmlFor={`cf-${def.id}`}>
              {def.label}
              {def.required && <span className="text-destructive">*</span>}
            </FieldLabel>
            {def.helpText && <FieldDescription>{def.helpText}</FieldDescription>}
          </div>
          {def.type !== "BOOLEAN" && (
            <CustomFieldInput
              def={def}
              value={values[def.id]}
              onChange={(v) => onChange(def.id, v)}
              users={users}
              invalid={!!errors?.[def.id]}
            />
          )}
          <FieldError errors={[errors?.[def.id]]} />
        </Field>
      ))}
    </div>
  )
}
