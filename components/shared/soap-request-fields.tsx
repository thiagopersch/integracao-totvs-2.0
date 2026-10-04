"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { SoapTypedInput } from "@/components/shared/soap-typed-input"
import { CHECKLIST_LAYOUTS, buildLayoutTabs } from "@/lib/tbc-checklist-layouts"
import type { FieldInputMeta } from "@/utils/soap-field-input"
import type { SchemaField, SchemaTable } from "@/utils/soap-schema"
import { listXmlLeafGroups, setXmlLeafValue } from "@/utils/xml-fields"

type FieldItem = {
  key: string
  name: string
  label: string
  meta: FieldInputMeta
  value: string
  onChange: (value: string) => void
  isPrimaryKey?: boolean
  required?: boolean
  readOnly?: boolean
}

type FieldBlock = { title?: string; fields: FieldItem[] }
type FieldGroup = { key: string; title: string; blocks: FieldBlock[] }

function matches(field: FieldItem, query: string): boolean {
  return field.name.toLowerCase().includes(query) || field.label.toLowerCase().includes(query)
}

/** Every group as a collapsed accordion item; a search opens (and narrows) the ones that match. */
function FieldGroups({ groups }: { groups: FieldGroup[] }) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState<string[]>([])
  const query = search.trim().toLowerCase()

  const visibleGroups = useMemo(() => {
    if (!query) return groups
    return groups
      .map((group) => ({
        ...group,
        blocks: group.blocks
          .map((block) => ({ ...block, fields: block.fields.filter((f) => matches(f, query)) }))
          .filter((block) => block.fields.length),
      }))
      .filter((group) => group.blocks.length)
  }, [groups, query])

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar campo por nome ou descrição..."
          className="pl-8"
        />
      </div>
      {visibleGroups.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Nenhum campo encontrado.</p>
      ) : (
        <Accordion
          multiple
          value={query ? visibleGroups.map((g) => g.key) : open}
          onValueChange={(value) => {
            if (!query) setOpen(value as string[])
          }}
          className="rounded-md border px-3"
        >
          {visibleGroups.map((group) => {
            const fields = group.blocks.flatMap((b) => b.fields)
            const filled = fields.filter((f) => f.value !== "").length
            return (
              <AccordionItem key={group.key} value={group.key}>
                <AccordionTrigger>
                  <span className="flex flex-wrap items-center gap-2">
                    <span>{group.title}</span>
                    <Badge variant={filled ? "default" : "outline"} className="text-[10px]">
                      {filled}/{fields.length} preenchido(s)
                    </Badge>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-4 pb-2">
                    {group.blocks.map((block, i) => (
                      <div key={`${block.title ?? ""}-${i}`} className="space-y-2">
                        {block.title && (
                          <p className="border-b pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            {block.title}
                          </p>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                          {block.fields.map((field) => (
                            <Field key={field.key}>
                              <FieldLabel htmlFor={field.key} title={`${field.label} (${field.name})`} className="text-xs">
                                <span className="truncate">{field.label}</span>
                                {field.required && !field.readOnly && <span className="text-destructive">*</span>}
                                {field.isPrimaryKey && <Badge variant="outline" className="text-[9px]">PK</Badge>}
                                {field.readOnly && <Badge variant="secondary" className="text-[9px]">somente leitura</Badge>}
                                {field.label !== field.name && (
                                  <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{field.name}</span>
                                )}
                              </FieldLabel>
                              <SoapTypedInput
                                id={field.key}
                                meta={field.meta}
                                value={field.value}
                                onChange={field.onChange}
                                disabled={field.readOnly}
                              />
                            </Field>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      )}
    </div>
  )
}

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/**
 * Data Server fields grouped like TOTVS RM's own screen when the checklist has a layout for it
 * (CHECKLIST_LAYOUTS, e.g. Processo Seletivo / Área Ofertada) — one group per screen tab, one block
 * per section. Unlike the checklist, every primary key is kept (child tables' keys are required on
 * SaveRecord) and no field is ever left out or listed twice. Without a layout: one group per table,
 * split into key / required / optional / read-only blocks in schema order.
 */
export function buildRecordGroups(
  dataserverCode: string,
  tables: SchemaTable[],
  toItem: (table: string, field: SchemaField) => FieldItem
): FieldGroup[] {
  const layout = Object.entries(CHECKLIST_LAYOUTS).find(([code]) => sameName(code, dataserverCode))?.[1]
  const mainTable = tables[0]?.name ?? ""

  if (!layout) {
    return tables.map((table) => {
      const items = table.fields.map((f) => ({ field: f, item: toItem(table.name, f) }))
      const blocks: FieldBlock[] = [
        { title: "Chave primária", fields: items.filter(({ field }) => field.isPrimaryKey).map(({ item }) => item) },
        {
          title: "Obrigatórios",
          fields: items.filter(({ field }) => !field.isPrimaryKey && !field.readOnly && field.required).map(({ item }) => item),
        },
        {
          title: "Opcionais",
          fields: items.filter(({ field }) => !field.isPrimaryKey && !field.readOnly && !field.required).map(({ item }) => item),
        },
        {
          title: "Somente leitura",
          fields: items.filter(({ field }) => !field.isPrimaryKey && field.readOnly).map(({ item }) => item),
        },
      ].filter((block) => block.fields.length)
      return { key: table.name, title: table.name, blocks }
    })
  }

  const used = new Set<string>()
  const firstBlockOfTable = new Map<string, FieldBlock>()
  const groups: FieldGroup[] = buildLayoutTabs(layout, tables, mainTable).map((tab, tabIndex) => ({
    key: `tab-${tabIndex}`,
    title: tab.name,
    blocks: tab.sections.flatMap((section) => {
      const table = tables.find((t) => sameName(t.name, section.table))
      if (!table) return []
      const fields = section.fields
        ? section.fields.flatMap((name) => table.fields.filter((f) => sameName(f.name, name)))
        : table.fields
      const items = fields
        .filter((f) => !used.has(`${table.name}.${f.name}`))
        .map((f) => {
          used.add(`${table.name}.${f.name}`)
          return toItem(table.name, f)
        })
      if (!items.length) return []
      const block: FieldBlock = {
        title: section.title ?? (sameName(table.name, mainTable) ? undefined : table.name),
        fields: items,
      }
      if (!firstBlockOfTable.has(table.name)) firstBlockOfTable.set(table.name, block)
      return [block]
    }),
  }))

  // Keys the checklist hides (child tables repeat the parent's) and anything else left out.
  const leftovers: FieldBlock[] = []
  for (const table of tables) {
    const missing = table.fields.filter((f) => !used.has(`${table.name}.${f.name}`))
    if (!missing.length) continue
    const keys = missing.filter((f) => f.isPrimaryKey).map((f) => toItem(table.name, f))
    const others = missing.filter((f) => !f.isPrimaryKey).map((f) => toItem(table.name, f))
    const target = firstBlockOfTable.get(table.name)
    if (target) {
      target.fields = [...keys, ...target.fields]
      if (others.length) leftovers.push({ title: table.name, fields: others })
    } else {
      leftovers.push({ title: table.name, fields: [...keys, ...others] })
    }
  }
  if (leftovers.length) groups.push({ key: "leftovers", title: "Demais campos", blocks: leftovers })

  return groups.filter((group) => group.blocks.length)
}

interface SchemaRecordFieldsProps {
  dataserverCode: string
  tables: SchemaTable[]
  values: Record<string, Record<string, string>>
  onChange: (table: string, field: string, value: string) => void
}

/** SaveRecord/DeleteRecord payload as typed inputs, labeled by each field's schema caption
 *  (e.g. IDPS → "Identificador do processo seletivo"). */
export function SchemaRecordFields({ dataserverCode, tables, values, onChange }: SchemaRecordFieldsProps) {
  const groups = buildRecordGroups(dataserverCode, tables, (table, f) => ({
    key: `${table}.${f.name}`,
    name: f.name,
    label: f.caption && f.caption !== "-" ? f.caption : f.name,
    meta: { type: f.type, maxLength: f.maxLength, defaultValue: f.defaultValue, caption: f.caption },
    value: values[table]?.[f.name] ?? "",
    onChange: (v) => onChange(table, f.name, v),
    isPrimaryKey: f.isPrimaryKey,
    required: f.required,
    readOnly: f.readOnly,
  }))
  return <FieldGroups groups={groups} />
}

interface XmlLeafFieldsProps {
  xml: string
  onChange: (xml: string) => void
}

/** A process's parameter XML (GetSchema sample instance) as typed inputs — one group per element
 *  holding values; edits are written straight back into the XML that gets sent. */
export function XmlLeafFields({ xml, onChange }: XmlLeafFieldsProps) {
  const leafGroups = useMemo(() => listXmlLeafGroups(xml), [xml])
  if (!leafGroups.length) {
    return <p className="p-4 text-sm text-muted-foreground">Não foi possível montar os campos a partir do XML da requisição.</p>
  }
  const groups: FieldGroup[] = leafGroups.map((group) => ({
    key: group.key,
    title: group.name,
    blocks: [
      {
        fields: group.fields.map((f) => ({
          key: f.path.join("."),
          name: f.label,
          label: f.label,
          meta: { type: f.type },
          value: f.value,
          onChange: (v: string) => onChange(setXmlLeafValue(xml, f.path, v)),
        })),
      },
    ],
  }))
  return <FieldGroups groups={groups} />
}
