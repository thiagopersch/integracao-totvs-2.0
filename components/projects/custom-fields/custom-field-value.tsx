"use client"

import { ColorBadge } from "@/components/shared/color-badge"
import { formatCustomFieldValue, isEmptyCustomFieldValue, type CustomFieldDef, type CustomFieldValue } from "@/lib/custom-fields"

interface CustomFieldValueViewProps {
  def: CustomFieldDef
  value: CustomFieldValue | undefined
  usersById?: Record<string, string>
}

/** Read-only rendering of a custom field value (table cells, overview). */
export function CustomFieldValueView({ def, value, usersById }: CustomFieldValueViewProps) {
  if (isEmptyCustomFieldValue(value)) return <span className="text-muted-foreground">-</span>
  const options = def.options ?? []

  if (def.type === "SELECT" || def.type === "MULTISELECT") {
    const ids = Array.isArray(value) ? value : [String(value)]
    return (
      <div className="flex flex-wrap gap-1">
        {ids.map((id) => {
          const option = options.find((o) => o.id === id)
          return option ? <ColorBadge key={id} label={option.label} color={option.color || "#6b7280"} /> : null
        })}
      </div>
    )
  }
  if (def.type === "URL") {
    return (
      <a href={String(value)} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">
        {String(value)}
      </a>
    )
  }
  return <span className="whitespace-pre-wrap">{formatCustomFieldValue(def, value, usersById)}</span>
}
