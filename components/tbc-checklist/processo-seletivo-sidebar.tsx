"use client"

import { useState } from "react"
import { Loader2, Search, Settings2, FolderKanban, PanelLeftClose, PanelLeftOpen, RefreshCw, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { CodeEditor } from "@/components/shared/code-editor"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { cn } from "@/lib/utils"
import { fetchDataserverRows, fetchDataserverSchema, type ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { buildDefaultFiltro } from "@/lib/tbc-checklist-filtro"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

export type ProcessoSeletivo = {
  id: string
  label: string
  row: Record<string, string>
  /** Data Server used to list this processo, its main table, and PK field names — so the
   *  checklist for this same Data Server can be auto-loaded (and related Data Servers pre-filled)
   *  without the user re-entering context that's already known. */
  sourceDataserverCode: string
  sourceTableName: string
  pkFieldNames: string[]
}

interface ProcessoSeletivoSidebarProps {
  tbcId: string
  dataservers: Dataserver[]
  selectedProcesso: ProcessoSeletivo | null
  onSelectProcesso: (processo: ProcessoSeletivo | null) => void
  context: ChecklistContext
  onContextChange: (context: ChecklistContext) => void
}

/** Numeric-aware descending compare — most TOTVS id/code fields are numeric strings ("3", "12"),
 *  where a plain string sort would put "12" before "3". Falls back to a descending locale compare
 *  when either side isn't a plain number. */
function compareDesc(a: string, b: string): number {
  const numA = Number(a)
  const numB = Number(b)
  if (a.trim() !== "" && b.trim() !== "" && Number.isFinite(numA) && Number.isFinite(numB)) {
    return numB - numA
  }
  return b.localeCompare(a)
}

export function ProcessoSeletivoSidebar({
  tbcId,
  dataservers,
  selectedProcesso,
  onSelectProcesso,
  context,
  onContextChange,
}: ProcessoSeletivoSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [configuring, setConfiguring] = useState(true)
  const [dataserverId, setDataserverId] = useState("")
  const [filtro, setFiltro] = useState("")
  const [schemaLoading, setSchemaLoading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fields, setFields] = useState<{ name: string; caption: string; isPrimaryKey: boolean }[]>([])
  const [tableName, setTableName] = useState("")
  const [idField, setIdField] = useState("")
  const [labelField, setLabelField] = useState("")
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [appliedFieldFilters, setAppliedFieldFilters] = useState<Record<string, string>>({})

  const selectedDataserver = dataservers.find((d) => d.id === dataserverId)

  async function handleFetchSchema(dataserver: Dataserver) {
    setSchemaLoading(true)
    const result = await fetchDataserverSchema({ tbcId, dataserverCode: dataserver.code, context })
    setSchemaLoading(false)
    if (!result.success) {
      toast.error(result.error || `Falha ao buscar schema do Data Server "${dataserver.name}"`)
      return
    }
    setFiltro(buildDefaultFiltro(result.tables))
    setTableName(result.tables[0]?.name ?? "")
    const schemaFields = (result.tables[0]?.fields ?? []).map((f) => ({
      name: f.name,
      caption: f.caption && f.caption !== "-" ? f.caption : f.name,
      isPrimaryKey: f.isPrimaryKey,
    }))
    setFields(schemaFields)
    setIdField(schemaFields.find((f) => f.isPrimaryKey)?.name || schemaFields[0]?.name || "")
    setLabelField(schemaFields.find((f) => !f.isPrimaryKey)?.name || schemaFields[0]?.name || "")
  }

  async function handleSelectDataserver(id: string) {
    setDataserverId(id)
    setFields([])
    setRows([])
    setFiltro("")
    const dataserver = dataservers.find((d) => d.id === id)
    if (!dataserver) return
    await handleFetchSchema(dataserver)
  }

  async function handleFetch() {
    if (!selectedDataserver) return
    setLoading(true)
    const result = await fetchDataserverRows({ tbcId, dataserverCode: selectedDataserver.code, filtro, context })
    setLoading(false)
    if (!result.success) {
      toast.error(result.error || "Falha ao buscar processos seletivos")
      return
    }
    setRows(result.rows)
    setConfiguring(false)
  }

  const pkFieldNames = fields.filter((f) => f.isPrimaryKey).map((f) => f.name)
  const processos: ProcessoSeletivo[] = (() => {
    const byId = new Map<string, ProcessoSeletivo>()
    for (const row of rows) {
      const id = row[idField] ?? ""
      if (byId.has(id)) continue
      const displayLabel = row[labelField] || id || "(sem nome)"
      byId.set(id, {
        id,
        label: id ? `${id} - ${displayLabel}` : displayLabel,
        row,
        sourceDataserverCode: selectedDataserver?.code ?? "",
        sourceTableName: tableName,
        pkFieldNames,
      })
    }
    return Array.from(byId.values()).sort((a, b) => compareDesc(a.id, b.id))
  })()
  const activeFieldFilters = Object.entries(appliedFieldFilters).filter(([, value]) => value.trim() !== "")
  const filteredProcessos = processos
    .filter((p) => !search.trim() || p.label.toLowerCase().includes(search.trim().toLowerCase()))
    .filter((p) =>
      activeFieldFilters.every(([field, value]) => (p.row[field] ?? "").toLowerCase().includes(value.trim().toLowerCase()))
    )

  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-md border transition-[width] duration-200 ease-out",
        collapsed ? "w-12" : "w-[380px]"
      )}
    >
      {collapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 p-2">
          <Button type="button" variant="ghost" size="icon" title="Expandir processos seletivos" onClick={() => setCollapsed(false)}>
            <PanelLeftOpen className="h-4 w-4" />
          </Button>
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
        </div>
      ) : configuring ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderKanban className="h-4 w-4" />
              Processos Seletivos
            </div>
            <Button type="button" variant="ghost" size="icon" title="Recolher" onClick={() => setCollapsed(true)}>
              <PanelLeftClose className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Selecione o Data Server do TOTVS que representa os processos seletivos para listá-los ao vivo.
          </p>
          <Field>
            <FieldLabel>Data Server</FieldLabel>
            <Combobox
              items={dataservers.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
              value={dataserverId}
              onValueChange={handleSelectDataserver}
              placeholder="Selecione um Data Server"
              searchPlaceholder="Buscar Data Server..."
              emptyText="Nenhum Data Server cadastrado."
            />
          </Field>

          <Accordion defaultValue={[]}>
            <AccordionItem value="filtro">
              <AccordionTrigger>Contexto e filtro (ReadView)</AccordionTrigger>
              <AccordionContent className="flex flex-col gap-3">
                <ChecklistContextFields value={context} onChange={onContextChange} />
                <Field>
                  <div className="flex items-center justify-between gap-2">
                    <FieldLabel>Filtro (condição SQL, ex.: TABELA.CAMPO = &apos;valor&apos;)</FieldLabel>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => selectedDataserver && handleFetchSchema(selectedDataserver)}
                      disabled={!selectedDataserver || schemaLoading}
                      title="Buscar esquema novamente (ex.: após ajustar coligada/filial)"
                    >
                      <RefreshCw className={schemaLoading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                      Buscar esquema
                    </Button>
                  </div>
                  {schemaLoading ? (
                    <div className="flex h-[100px] items-center justify-center rounded-md border text-sm text-muted-foreground">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Buscando schema...
                    </div>
                  ) : (
                    <CodeEditor value={filtro} onChange={setFiltro} language="sql" minHeight="100px" resetKey={dataserverId} />
                  )}
                </Field>
              </AccordionContent>
            </AccordionItem>
          </Accordion>

          {fields.length > 0 && (
            <>
              <Field>
                <FieldLabel>Campo de identificação</FieldLabel>
                <Select items={fields.map((f) => ({ value: f.name, label: f.caption }))} value={idField} onValueChange={(v) => setIdField(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.caption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Campo de exibição (nome)</FieldLabel>
                <Select items={fields.map((f) => ({ value: f.name, label: f.caption }))} value={labelField} onValueChange={(v) => setLabelField(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.name} value={f.name}>
                        {f.caption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </>
          )}

          <Button type="button" onClick={handleFetch} disabled={!selectedDataserver || !idField || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Buscar registros
          </Button>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FolderKanban className="h-4 w-4" />
              Processos Seletivos
            </div>
            <div className="flex items-center">
              <Button type="button" variant="ghost" size="icon" title="Reconfigurar" onClick={() => setConfiguring(true)}>
                <Settings2 className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="icon" title="Recolher" onClick={() => setCollapsed(true)}>
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {fields.length > 0 && (
            <Button
              type="button"
              variant={filtersOpen ? "secondary" : "outline"}
              size="sm"
              className={cn("h-9 justify-start", filtersOpen && "border-primary")}
              onClick={() => setFiltersOpen((v) => !v)}
            >
              <FilterIcon className="mr-2 h-4 w-4" />
              Filtros
              {activeFieldFilters.length > 0 && (
                <span className="ml-auto rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFieldFilters.length}
                </span>
              )}
            </Button>
          )}
          {filtersOpen && (
            <DataTableFilterPanel
              onApply={() => {
                setAppliedFieldFilters(fieldFilters)
                setFiltersOpen(false)
              }}
              onClear={() => {
                setFieldFilters({})
                setAppliedFieldFilters({})
              }}
            >
              {fields.map((f) => (
                <div key={f.name} className="space-y-2">
                  <Label>{f.caption}</Label>
                  <Input
                    value={fieldFilters[f.name] ?? ""}
                    onChange={(e) => setFieldFilters((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    placeholder={`Filtrar por ${f.caption}...`}
                  />
                </div>
              ))}
            </DataTableFilterPanel>
          )}
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-1 pr-2">
              {filteredProcessos.length === 0 && (
                <p className="p-2 text-xs text-muted-foreground">Nenhum processo seletivo encontrado.</p>
              )}
              {filteredProcessos.map((processo) => (
                <Tooltip key={processo.id}>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        onClick={() => onSelectProcesso(processo)}
                        className={cn(
                          "block w-full truncate rounded-md px-2 py-2 text-left text-sm hover:bg-accent",
                          selectedProcesso?.id === processo.id && "bg-accent font-medium"
                        )}
                      >
                        {processo.label}
                      </button>
                    }
                  />
                  <TooltipContent>{processo.label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
