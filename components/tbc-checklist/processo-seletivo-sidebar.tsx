"use client"

import { useRef, useState } from "react"
import { Loader2, Search, Settings2, FolderKanban, PanelLeftClose, PanelLeftOpen, RefreshCw, Filter as FilterIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { MultiSelect } from "@/components/ui/multi-select"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { PrimaryKeyInputs } from "@/components/tbc-checklist/primary-key-inputs"
import { PermissionDeniedAlert } from "@/components/tbc-checklist/permission-denied-alert"
import { useDataserverSchema } from "@/components/tbc-checklist/use-dataserver-schema"
import { cn } from "@/lib/utils"
import { fetchDataserverRows, type ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { buildPkFiltro } from "@/lib/tbc-checklist-filtro"
import {
  EMPTY_CONTEXT_FORM,
  PROCESSO_SELETIVO_DATASERVER,
  toChecklistContext,
  type ChecklistContextForm,
} from "@/lib/tbc-checklist-dataservers"
import type { SchemaTable } from "@/utils/soap-schema"
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
  /** This processo's own PK values (e.g. CODCOLIGADA + IDPS) — the key every related Data Server
   *  (área ofertada, forma de inscrição…) is looked up by. */
  pkValues: Record<string, string>
  /** Contexto (coligada/filial/tipo de curso) the processo was listed with, reused to load it. */
  context: ChecklistContext
}

/** Processo-listing setup saved with a checklist, so reopening it lists the processos right away. */
export type ChecklistListing = {
  dataserverCode: string | null
  context: ChecklistContextForm
  idFields: string[]
  labelField: string | null
}

interface ProcessoSeletivoSidebarProps {
  tbcId: string
  dataservers: Dataserver[]
  selectedProcesso: ProcessoSeletivo | null
  onSelectProcesso: (processo: ProcessoSeletivo | null) => void
  /** TBC user the SOAP calls run as — named in the "sem permissão" message. */
  tbcUser?: string
  /** Setup saved with the active checklist — pre-fills the form; when complete, the processos are
   *  listed as soon as the schema arrives. Read on mount only (remount with a key to change it). */
  initialListing?: ChecklistListing
  /** Every successful listing reports the setup it used, for the caller to persist. */
  onListingFetched?: (listing: ChecklistListing) => void
}

type SchemaFieldOption = { name: string; caption: string; isPrimaryKey: boolean }

const NAME_FIELD_PATTERN = /^(NOME|DESCRICAO)/i

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

/** Descending by the identification fields, last one first (IDPS before CODCOLIGADA) — newest
 *  processos on top regardless of coligada. */
function compareRowsDesc(a: Record<string, string>, b: Record<string, string>, idFields: string[]): number {
  for (const field of [...idFields].reverse()) {
    const diff = compareDesc(a[field] ?? "", b[field] ?? "")
    if (diff !== 0) return diff
  }
  return 0
}

export function ProcessoSeletivoSidebar({
  tbcId,
  dataservers,
  selectedProcesso,
  onSelectProcesso,
  tbcUser,
  initialListing,
  onListingFetched,
}: ProcessoSeletivoSidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [configuring, setConfiguring] = useState(true)
  const [dataserverId, setDataserverId] = useState(
    () =>
      dataservers.find((d) => d.code === (initialListing?.dataserverCode || PROCESSO_SELETIVO_DATASERVER))?.id ??
      dataservers.find((d) => d.code === PROCESSO_SELETIVO_DATASERVER)?.id ??
      ""
  )
  const [contextForm, setContextForm] = useState<ChecklistContextForm>(initialListing?.context ?? EMPTY_CONTEXT_FORM)
  // The saved setup is applied (and listed) on the first schema load only — later loads are the
  // user reconfiguring, which gets the regular defaults.
  const savedListingRef = useRef(initialListing?.dataserverCode ? initialListing : undefined)
  const [pkValues, setPkValues] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  // ReadView of the listing refused by TOTVS for lack of permission (code of that Data Server).
  const [rowsDeniedCode, setRowsDeniedCode] = useState("")
  const [fields, setFields] = useState<SchemaFieldOption[]>([])
  const [tableName, setTableName] = useState("")
  const [idFields, setIdFields] = useState<string[]>([])
  const [labelField, setLabelField] = useState("")
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [listedContext, setListedContext] = useState<ChecklistContext | null>(null)
  const [search, setSearch] = useState("")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [fieldFilters, setFieldFilters] = useState<Record<string, string>>({})
  const [appliedFieldFilters, setAppliedFieldFilters] = useState<Record<string, string>>({})

  const selectedDataserver = dataservers.find((d) => d.id === dataserverId)

  async function fetchRows(
    dataserverCode: string,
    table: string,
    pk: Record<string, string>,
    context: ChecklistContext,
    usedIdFields: string[],
    usedLabelField: string
  ) {
    setLoading(true)
    const result = await fetchDataserverRows({
      tbcId,
      dataserverCode,
      filtro: buildPkFiltro(table, pk),
      context,
    })
    setLoading(false)
    if (!result.success) {
      if (result.permissionDenied) {
        setRowsDeniedCode(dataserverCode)
        return
      }
      toast.error(result.error || "Falha ao buscar processos seletivos")
      return
    }
    setRowsDeniedCode("")
    setRows(result.rows)
    setListedContext(context)
    setConfiguring(false)
    onListingFetched?.({
      dataserverCode,
      context: { coligate: String(context.coligate), branch: String(context.branch), levelEducation: String(context.levelEducation) },
      idFields: usedIdFields,
      labelField: usedLabelField || null,
    })
  }

  function handleSchemaLoaded(tables: SchemaTable[]) {
    setTableName(tables[0]?.name ?? "")
    const schemaFields = (tables[0]?.fields ?? []).map((f) => ({
      name: f.name,
      caption: f.caption && f.caption !== "-" ? f.caption : f.name,
      isPrimaryKey: f.isPrimaryKey,
    }))
    setFields(schemaFields)
    const pkNames = schemaFields.filter((f) => f.isPrimaryKey).map((f) => f.name)
    // The coligada typed in the Contexto is the processo's coligada too — pre-fill it (editable).
    const initialPkValues = Object.fromEntries(
      pkNames.map((name) => [name, name.toUpperCase() === "CODCOLIGADA" ? contextForm.coligate.trim() : ""])
    )
    setPkValues(initialPkValues)
    // Identification defaults to the whole primary key (coligada + processo seletivo), so processos
    // of different coligadas sharing an IDPS never collapse into one.
    const nonPk = schemaFields.filter((f) => !f.isPrimaryKey)
    const exists = (name: string | null | undefined) => !!name && schemaFields.some((f) => f.name === name)
    const saved = savedListingRef.current
    savedListingRef.current = undefined
    const savedIdFields = saved?.idFields.filter(exists) ?? []
    const nextIdFields = savedIdFields.length ? savedIdFields : pkNames.length ? pkNames : schemaFields.slice(0, 1).map((f) => f.name)
    const nextLabelField = exists(saved?.labelField)
      ? (saved?.labelField as string)
      : nonPk.find((f) => NAME_FIELD_PATTERN.test(f.name))?.name || nonPk[0]?.name || schemaFields[0]?.name || ""
    setIdFields(nextIdFields)
    setLabelField(nextLabelField)

    const table = tables[0]?.name ?? ""
    const context = toChecklistContext(contextForm)
    // Saved setup: list the processos right away, as if "Buscar registros" had been clicked.
    if (saved && selectedDataserver && context && table) {
      void fetchRows(selectedDataserver.code, table, initialPkValues, context, nextIdFields, nextLabelField)
    }
  }

  const schema = useDataserverSchema(tbcId, selectedDataserver, contextForm, handleSchemaLoaded)

  function handleSelectDataserver(id: string) {
    setDataserverId(id)
    setFields([])
    setRows([])
    setPkValues({})
    setIdFields([])
    setLabelField("")
    setTableName("")
  }

  async function handleFetch() {
    if (!selectedDataserver || !schema.context) return
    await fetchRows(selectedDataserver.code, tableName, pkValues, schema.context, idFields, labelField)
  }

  const pkFields = fields.filter((f) => f.isPrimaryKey)
  const pkFieldNames = pkFields.map((f) => f.name)
  const processos: ProcessoSeletivo[] = (() => {
    if (!listedContext || !idFields.length) return []
    const byId = new Map<string, ProcessoSeletivo>()
    const sortedRows = [...rows].sort((a, b) => compareRowsDesc(a, b, idFields))
    for (const row of sortedRows) {
      const idParts = idFields.map((f) => row[f] ?? "")
      const id = idParts.join("-")
      if (byId.has(id)) continue
      const displayLabel = row[labelField] || "(sem nome)"
      const idLabel = idParts.filter((v) => v !== "").join(" - ")
      byId.set(id, {
        id,
        label: idLabel ? `${idLabel} - ${displayLabel}` : displayLabel,
        row,
        sourceDataserverCode: selectedDataserver?.code ?? "",
        sourceTableName: tableName,
        pkFieldNames,
        pkValues: Object.fromEntries(pkFieldNames.map((name) => [name, row[name] ?? ""])),
        context: listedContext,
      })
    }
    return Array.from(byId.values())
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
        // Full width (capped height) when stacked on small screens; fixed side column from lg up.
        collapsed ? "w-full lg:w-12" : "max-h-[60vh] w-full lg:max-h-none lg:w-[380px]"
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

          <ChecklistContextFields value={contextForm} onChange={setContextForm} />

          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel>Chave primária (filtro)</FieldLabel>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => void schema.refetch()}
                disabled={!selectedDataserver || !schema.contextComplete || schema.loading}
                title="Buscar esquema novamente"
              >
                <RefreshCw className={schema.loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
                Buscar esquema
              </Button>
            </div>
            {!schema.contextComplete ? (
              <p className="text-xs text-muted-foreground">
                Preencha coligada, filial e tipo de curso para buscar o esquema do Data Server.
              </p>
            ) : schema.loading ? (
              <div className="flex h-16 items-center justify-center rounded-md border text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Buscando esquema...
              </div>
            ) : schema.permissionDenied && selectedDataserver ? (
              <PermissionDeniedAlert
                tbcUser={tbcUser}
                dataservers={[{ code: selectedDataserver.code, name: selectedDataserver.name }]}
              />
            ) : fields.length > 0 ? (
              <PrimaryKeyInputs fields={pkFields} values={pkValues} onChange={setPkValues} />
            ) : null}
          </Field>

          {fields.length > 0 && (
            <>
              <Field>
                <FieldLabel>Campos de identificação</FieldLabel>
                <MultiSelect
                  items={fields.map((f) => ({ value: f.name, label: f.caption }))}
                  value={idFields}
                  onValueChange={setIdFields}
                  placeholder="Selecione os campos"
                  searchPlaceholder="Buscar campo..."
                />
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

          {selectedDataserver && rowsDeniedCode === selectedDataserver.code && !schema.permissionDenied && (
            <PermissionDeniedAlert
              tbcUser={tbcUser}
              dataservers={[{ code: selectedDataserver.code, name: selectedDataserver.name }]}
            />
          )}

          <Button
            type="button"
            onClick={handleFetch}
            disabled={!selectedDataserver || !schema.contextComplete || !fields.length || !idFields.length || loading}
          >
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
              singleColumn
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
