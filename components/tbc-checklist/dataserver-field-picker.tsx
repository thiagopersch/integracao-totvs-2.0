"use client"

import { useMemo, useState } from "react"
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, KeyRound, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { ScrollableTabsList, Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { buildPickerTabs, fieldKey, type ChecklistSelection, type PickerSection, type PickerTab } from "@/lib/tbc-checklist-selection"
import type { SchemaTable } from "@/utils/soap-schema"

interface DataserverFieldPickerProps {
  dataserverCode: string
  /** Every table/field GetSchema returned for the Data Server. */
  tables: SchemaTable[]
  /** Picked fields — never primary keys: those are always included and shown locked. */
  value: ChecklistSelection
  onChange: (value: ChecklistSelection) => void
}

const captionOf = (caption: string, name: string) => (caption && caption !== "-" ? caption : name)

/** Keys of the section's fields the user can (un)pick — primary keys are locked. */
const pickableKeys = (section: PickerSection) =>
  section.fields.filter((f) => !f.isPrimaryKey).map((f) => fieldKey(section.table, f.name))

const countSelected = (sections: PickerSection[], value: ChecklistSelection) =>
  sections.reduce((sum, s) => sum + pickableKeys(s).filter((k) => value.has(k)).length, 0)

const countPickable = (sections: PickerSection[]) => sections.reduce((sum, s) => sum + pickableKeys(s).length, 0)

/**
 * All fields of a Data Server grouped like the TOTVS RM screen (tabs → sections; one section per
 * table when there's no screen layout), as checkboxes in a 3-column grid — the user picks which
 * ones the checklist validates. Each section collapses on its own; the search narrows what is
 * listed (and what "Selecionar todos" acts on) without touching the selection itself.
 */
export function DataserverFieldPicker({ dataserverCode, tables, value, onChange }: DataserverFieldPickerProps) {
  const [search, setSearch] = useState("")
  const [chosenTab, setActiveTab] = useState("")
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const tabs = useMemo(() => buildPickerTabs(dataserverCode, tables), [dataserverCode, tables])

  const term = search.trim().toLowerCase()
  const visibleTabs: PickerTab[] = tabs
    .map((tab) => ({
      ...tab,
      sections: tab.sections
        .map((section) => ({
          ...section,
          fields: section.fields.filter(
            (f) => !term || f.name.toLowerCase().includes(term) || captionOf(f.caption, f.name).toLowerCase().includes(term)
          ),
        }))
        .filter((section) => section.fields.length > 0),
    }))
    .filter((tab) => tab.sections.length > 0)
  // The chosen tab may have no match for the current search.
  const activeTab = visibleTabs.some((t) => t.name === chosenTab) ? chosenTab : (visibleTabs[0]?.name ?? "")
  const activeSections = visibleTabs.find((t) => t.name === activeTab)?.sections ?? []

  const allSections = tabs.flatMap((t) => t.sections)
  // A field listed in two sections is still one field.
  const totalPickable = new Set(allSections.flatMap(pickableKeys)).size
  const totalSelected = new Set(allSections.flatMap(pickableKeys).filter((k) => value.has(k))).size

  function toggle(keys: string[], checked: boolean) {
    const next = new Set(value)
    for (const key of keys) {
      if (checked) next.add(key)
      else next.delete(key)
    }
    onChange(next)
  }

  function setSectionsCollapsed(keys: string[], collapse: boolean) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      for (const key of keys) {
        if (collapse) next.add(key)
        else next.delete(key)
      }
      return next
    })
  }

  const sectionList = (sections: PickerSection[]) => (
    <div className="flex flex-col gap-3">
      {sections.map((section) => (
        <PickerSectionBox
          key={section.key}
          section={section}
          value={value}
          open={!collapsed.has(section.key)}
          onToggleOpen={() => setSectionsCollapsed([section.key], !collapsed.has(section.key))}
          onToggleFields={toggle}
        />
      ))}
    </div>
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="absolute top-2.5 left-2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8" placeholder="Buscar campo..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <span className="text-xs text-muted-foreground">
          {totalSelected} de {totalPickable} campos selecionados
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setSectionsCollapsed(activeSections.map((s) => s.key), true)}
          disabled={!activeSections.length}
        >
          <ChevronsDownUp className="mr-1 h-3.5 w-3.5" />
          Recolher todas
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-xs"
          onClick={() => setSectionsCollapsed(activeSections.map((s) => s.key), false)}
          disabled={!activeSections.length}
        >
          <ChevronsUpDown className="mr-1 h-3.5 w-3.5" />
          Expandir todas
        </Button>
      </div>

      {visibleTabs.length === 0 && <p className="text-sm text-muted-foreground">Nenhum campo encontrado.</p>}

      {visibleTabs.length === 1 && sectionList(visibleTabs[0].sections)}

      {visibleTabs.length > 1 && (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(String(v))}>
          <ScrollableTabsList>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.name} value={tab.name}>
                {tab.name}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({countSelected(tab.sections, value)}/{countPickable(tab.sections)})
                </span>
              </TabsTrigger>
            ))}
          </ScrollableTabsList>
          {visibleTabs.map((tab) => (
            <TabsContent key={tab.name} value={tab.name} className="pt-2">
              {sectionList(tab.sections)}
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  )
}

function PickerSectionBox({
  section,
  value,
  open,
  onToggleOpen,
  onToggleFields,
}: {
  section: PickerSection
  value: ChecklistSelection
  open: boolean
  onToggleOpen: () => void
  onToggleFields: (keys: string[], checked: boolean) => void
}) {
  const keys = pickableKeys(section)
  const selectedCount = keys.filter((k) => value.has(k)).length
  const contentId = `picker-section-${section.key}`

  return (
    <section className="rounded-md border">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left"
        >
          <ChevronDown className={cn("h-4 w-4 shrink-0 transition-transform", !open && "-rotate-90")} />
          <span className="text-sm font-medium break-words">{section.title}</span>
          <span className="text-xs text-muted-foreground">
            ({selectedCount}/{keys.length})
          </span>
          {section.title !== section.table && <span className="truncate text-xs text-muted-foreground">· {section.table}</span>}
        </button>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onToggleFields(keys, true)} disabled={!keys.length}>
            Selecionar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onToggleFields(keys, false)} disabled={!keys.length}>
            Limpar
          </Button>
        </div>
      </div>
      <div id={contentId} className={cn("grid grid-cols-1 gap-2 border-t p-3 sm:grid-cols-2 lg:grid-cols-3", !open && "hidden")}>
        {section.fields.map((field) => {
          const key = fieldKey(section.table, field.name)
          const locked = field.isPrimaryKey
          const checked = locked || value.has(key)
          const caption = captionOf(field.caption, field.name)
          return (
            <label
              key={field.name}
              className={cn(
                "flex min-w-0 items-start gap-2 rounded-md border px-2 py-1.5 transition-colors",
                locked ? "cursor-not-allowed" : "cursor-pointer",
                checked
                  ? "border-green-600 bg-green-100 text-green-900 dark:border-green-600 dark:bg-green-900/50 dark:text-green-300"
                  : "border-transparent hover:bg-accent"
              )}
              title={locked ? "Chave primária — sempre incluída, não é exibida no checklist" : `${section.table}.${field.name}`}
            >
              <Checkbox
                className="mt-0.5 data-checked:border-green-600 data-checked:bg-green-600 dark:data-checked:bg-green-600"
                checked={checked}
                disabled={locked}
                onCheckedChange={(next) => onToggleFields([key], next === true)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="flex items-center gap-1 text-sm break-words">
                  {caption}
                  {locked && <KeyRound className="h-3 w-3 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Chave primária" />}
                </span>
                {caption !== field.name && (
                  <span className={cn("truncate text-xs", checked ? "text-green-700 dark:text-green-400/80" : "text-muted-foreground")}>
                    {field.name}
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </section>
  )
}
