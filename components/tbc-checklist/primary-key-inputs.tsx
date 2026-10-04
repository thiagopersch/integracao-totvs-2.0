"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

interface PrimaryKeyInputsProps {
  fields: { name: string; caption: string }[]
  values: Record<string, string>
  onChange: (values: Record<string, string>) => void
}

/** One plain input per primary-key field of a Data Server's main table (e.g. CODCOLIGADA, IDPS),
 *  replacing the hand-written SQL filtro — every field is optional; only filled ones filter. */
export function PrimaryKeyInputs({ fields, values, onChange }: PrimaryKeyInputsProps) {
  if (!fields.length) {
    return <p className="text-xs text-muted-foreground">Este Data Server não tem chave primária — todos os registros serão buscados.</p>
  }
  return (
    <div className="flex flex-col gap-2">
      {fields.map((field) => (
        <Field key={field.name}>
          <FieldLabel title={field.name}>
            {field.caption !== field.name ? `${field.caption} (${field.name})` : field.name}
          </FieldLabel>
          <Input
            value={values[field.name] ?? ""}
            onChange={(e) => onChange({ ...values, [field.name]: e.target.value })}
          />
        </Field>
      ))}
    </div>
  )
}
