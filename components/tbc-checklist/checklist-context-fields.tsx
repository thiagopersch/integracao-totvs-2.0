"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"

interface ChecklistContextFieldsProps {
  value: ChecklistContextForm
  onChange: (value: ChecklistContextForm) => void
}

export function ChecklistContextFields({ value, onChange }: ChecklistContextFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field>
        <FieldLabel>Coligada</FieldLabel>
        <Input
          type="number"
          placeholder="Ex.: 1"
          value={value.coligate}
          onChange={(e) => onChange({ ...value, coligate: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel>Filial</FieldLabel>
        <Input
          type="number"
          placeholder="Ex.: 1"
          value={value.branch}
          onChange={(e) => onChange({ ...value, branch: e.target.value })}
        />
      </Field>
      <Field>
        <FieldLabel>Tipo de Curso</FieldLabel>
        <Input
          type="number"
          placeholder="Ex.: 1"
          value={value.levelEducation}
          onChange={(e) => onChange({ ...value, levelEducation: e.target.value })}
        />
      </Field>
    </div>
  )
}
