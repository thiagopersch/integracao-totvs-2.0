"use client"

import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { ChecklistContext } from "@/actions/integrations/tbc-checklist"

interface ChecklistContextFieldsProps {
  value: ChecklistContext
  onChange: (value: ChecklistContext) => void
}

export function ChecklistContextFields({ value, onChange }: ChecklistContextFieldsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <Field>
        <FieldLabel>Coligada</FieldLabel>
        <Input
          type="number"
          value={value.coligate}
          onChange={(e) => onChange({ ...value, coligate: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field>
        <FieldLabel>Filial</FieldLabel>
        <Input
          type="number"
          value={value.branch}
          onChange={(e) => onChange({ ...value, branch: Number(e.target.value) || 0 })}
        />
      </Field>
      <Field>
        <FieldLabel>Tipo de Curso</FieldLabel>
        <Input
          type="number"
          value={value.levelEducation}
          onChange={(e) => onChange({ ...value, levelEducation: Number(e.target.value) || 0 })}
        />
      </Field>
    </div>
  )
}
