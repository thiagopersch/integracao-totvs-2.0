"use client"

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { DateTimePicker } from "@/components/ui/date-time-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { CurrencyInput } from "@/components/ui/currency-input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { ColorBadge } from "@/components/shared/color-badge"
import { OptionSelect } from "@/components/projects/option-select"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import type { CustomFieldDef, CustomFieldValue } from "@/lib/custom-fields"

export type PickerUser = { id: string; name: string }

interface CustomFieldInputProps {
  def: CustomFieldDef
  value: CustomFieldValue | undefined
  onChange: (value: CustomFieldValue) => void
  onBlur?: () => void
  users?: PickerUser[]
  invalid?: boolean
}

const NONE = "__none__"

export function CustomFieldInput({ def, value, onChange, onBlur, users = [], invalid }: CustomFieldInputProps) {
  const id = `cf-${def.id}`
  const options = def.options ?? []
  const placeholder = def.config?.placeholder

  switch (def.type) {
    case "LONG_TEXT":
      return (
        <Textarea id={id} rows={3} value={(value as string) ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} aria-invalid={invalid} />
      )
    case "NUMBER":
      return (
        <Input
          id={id}
          type="number"
          step={def.config?.integer ? 1 : "any"}
          min={def.config?.min}
          max={def.config?.max}
          inputMode="decimal"
          placeholder={placeholder}
          value={value === null || value === undefined ? "" : String(value)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          onBlur={onBlur}
          aria-invalid={invalid}
        />
      )
    case "CURRENCY":
      return <CurrencyInput id={id} value={(value as number | null) ?? null} onValueChange={onChange} onBlur={onBlur} aria-invalid={invalid} />
    case "DATE":
      return <DatePicker id={id} value={(value as string) ?? ""} onValueChange={(v) => onChange(v || null)} aria-invalid={invalid} />
    case "DATETIME":
      return <DateTimePicker id={id} value={(value as string) ?? ""} onValueChange={(v) => onChange(v || null)} aria-invalid={invalid} />
    case "TIME":
      return <TimePicker id={id} value={(value as string) ?? ""} onValueChange={(v) => onChange(v || null)} aria-invalid={invalid} />
    case "SELECT":
      return (
        <OptionSelect
          id={id}
          options={options.map((o) => ({ value: o.id, label: o.label, color: o.color || "#6b7280" }))}
          value={(value as string) || ""}
          onChange={(v) => onChange(v || null)}
          emptyLabel="—"
          invalid={invalid}
        />
      )
    case "MULTISELECT":
      return (
        <MultiSelect
          items={options.map((o) => ({ value: o.id, label: o.label, color: o.color || undefined }))}
          value={Array.isArray(value) ? value : []}
          onValueChange={(v) => onChange(v)}
        />
      )
    case "CHECKBOX_GROUP": {
      const selected = Array.isArray(value) ? value : []
      return (
        <div id={id} className="flex flex-wrap gap-x-4 gap-y-2 pt-1" role="group" data-invalid={invalid || undefined}>
          {options.map((o) => (
            <label key={o.id} className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(o.id)}
                onCheckedChange={(checked) => onChange(checked ? [...selected, o.id] : selected.filter((x) => x !== o.id))}
              />
              <ColorBadge label={o.label} color={o.color || "#6b7280"} />
            </label>
          ))}
        </div>
      )
    }
    case "BOOLEAN":
      return <Switch id={id} checked={value === true} onCheckedChange={(c) => onChange(c)} />
    case "CHECKBOX":
      return <Checkbox id={id} checked={value === true} onCheckedChange={(c) => onChange(!!c)} aria-invalid={invalid} />
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
      return (
        <Input id={id} type="url" value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} placeholder={placeholder ?? "https://"} aria-invalid={invalid} />
      )
    default:
      return <Input id={id} value={(value as string) ?? ""} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} onBlur={onBlur} aria-invalid={invalid} />
  }
}

/** Single-line types that read better beside the label (switch/checkbox). */
const INLINE_TYPES = new Set(["BOOLEAN", "CHECKBOX"])
const WIDE_TYPES = new Set(["LONG_TEXT", "MULTISELECT", "CHECKBOX_GROUP"])

interface CustomFieldsFormSectionProps<T extends FieldValues> {
  /** react-hook-form control of a form whose schema has `customFields: buildCustomFieldsSchema(defs)`. */
  control: Control<T>
  defs: CustomFieldDef[]
  users?: PickerUser[]
}

/**
 * Renders every active definition in order, each bound to `customFields.<id>` with a Controller —
 * validation (type, required, configured rules) comes from the form's zod resolver.
 */
export function CustomFieldsFormSection<T extends FieldValues>({ control, defs, users }: CustomFieldsFormSectionProps<T>) {
  if (defs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nenhuma propriedade ativa. Crie em Projetos → Propriedades.
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {defs.map((def) => (
        <Controller
          key={def.id}
          control={control}
          name={`customFields.${def.id}` as Path<T>}
          render={({ field, fieldState }) => {
            const input = (
              <CustomFieldInput
                def={def}
                value={field.value as CustomFieldValue | undefined}
                onChange={field.onChange}
                onBlur={field.onBlur}
                users={users}
                invalid={!!fieldState.error}
              />
            )
            const label = (
              <div className="flex flex-col gap-1">
                <FieldLabel htmlFor={`cf-${def.id}`}>
                  {def.label}
                  {def.required && <span className="text-destructive">*</span>}
                </FieldLabel>
                {def.helpText && <FieldDescription>{def.helpText}</FieldDescription>}
              </div>
            )
            return (
              <Field className={WIDE_TYPES.has(def.type) ? "sm:col-span-2" : undefined} data-invalid={!!fieldState.error || undefined}>
                {INLINE_TYPES.has(def.type) ? (
                  <div className="flex items-start gap-3">
                    {input}
                    {label}
                  </div>
                ) : (
                  <>
                    {label}
                    {input}
                  </>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )
          }}
        />
      ))}
    </div>
  )
}
