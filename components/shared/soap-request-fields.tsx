"use client"

import { useMemo } from "react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import type { SchemaTable } from "@/utils/soap-schema"
import { listXmlLeafGroups, setXmlLeafValue } from "@/utils/xml-fields"

type Section = {
  key: string
  title: string
  fields: Array<{ key: string; label: string; name: string; required?: boolean; value: string; onChange: (v: string) => void }>
}

function FieldSections({ sections }: { sections: Section[] }) {
  return (
    <Accordion multiple defaultValue={sections.map((s) => s.key)} className="rounded-md border px-3">
      {sections.map((section) => (
        <AccordionItem key={section.key} value={section.key}>
          <AccordionTrigger>
            <span className="flex items-center gap-2">
              <span className="font-mono text-xs">{section.title}</span>
              <Badge variant="outline" className="text-[10px]">{section.fields.length} campo(s)</Badge>
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-1 gap-3 pb-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {section.fields.map((field) => (
                <Field key={field.key}>
                  <FieldLabel title={field.name} className="text-xs">
                    <span className="truncate">{field.label}</span>
                    {field.required && <span className="text-destructive">*</span>}
                  </FieldLabel>
                  <Input value={field.value} onChange={(e) => field.onChange(e.target.value)} placeholder={field.name} />
                </Field>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

interface SchemaRecordFieldsProps {
  tables: SchemaTable[]
  values: Record<string, Record<string, string>>
  onChange: (table: string, field: string, value: string) => void
}

/** SaveRecord/DeleteRecord payload as inputs — one section per Data Server table, each field
 *  labeled by its schema caption (e.g. IDPS → "Identificador do processo seletivo"). */
export function SchemaRecordFields({ tables, values, onChange }: SchemaRecordFieldsProps) {
  const sections: Section[] = tables.map((table) => ({
    key: table.name,
    title: table.name,
    fields: table.fields.map((f) => ({
      key: f.name,
      name: f.name,
      label: f.caption && f.caption !== "-" ? f.caption : f.name,
      required: f.isPrimaryKey,
      value: values[table.name]?.[f.name] ?? "",
      onChange: (v) => onChange(table.name, f.name, v),
    })),
  }))
  return <FieldSections sections={sections} />
}

interface XmlLeafFieldsProps {
  xml: string
  onChange: (xml: string) => void
}

/** A process's parameter XML (GetSchema sample instance) as inputs — one section per element
 *  holding values; edits are written straight back into the XML that gets sent. */
export function XmlLeafFields({ xml, onChange }: XmlLeafFieldsProps) {
  const groups = useMemo(() => listXmlLeafGroups(xml), [xml])
  if (!groups.length) {
    return <p className="p-4 text-sm text-muted-foreground">Não foi possível montar os campos a partir do XML da requisição.</p>
  }
  const sections: Section[] = groups.map((group) => ({
    key: group.key,
    title: group.name,
    fields: group.fields.map((f) => ({
      key: f.path.join("."),
      name: f.label,
      label: f.label,
      value: f.value,
      onChange: (v) => onChange(setXmlLeafValue(xml, f.path, v)),
    })),
  }))
  return <FieldSections sections={sections} />
}
