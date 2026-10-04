"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { AlertTriangle, ClipboardList, Loader2, Plus, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { ChecklistFieldCard } from "@/components/tbc-checklist/checklist-field-card"
import { FieldVisibilityMatrix } from "@/components/tbc-checklist/field-visibility-matrix"
import { visibleFields } from "@/lib/tbc-checklist-field-rules"
import { PermissionDeniedAlert, type DeniedDataserver } from "@/components/tbc-checklist/permission-denied-alert"
import { buildLayoutTabs, CHECKLIST_LAYOUTS, type LayoutSection, type LayoutTab } from "@/lib/tbc-checklist-layouts"
import type { AddedDataserver, TableLoadState } from "@/components/tbc-checklist/tbc-checklist-client"
import type { ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import type { ChecklistParent, ChecklistRecord, ChecklistTableResult } from "@/actions/integrations/tbc-checklist"

type LoadTables = (dataserver: AddedDataserver, tables: string[], parentKeys?: string[]) => void

interface ChecklistContentProps {
  selectedProcesso: ProcessoSeletivo | null
  addedDataservers: AddedDataserver[]
  /** Data Servers TOTVS refused the TBC user access to — listed in a red message. */
  deniedDataservers: DeniedDataserver[]
  /** TBC user the SOAP calls run as, named in that message. */
  tbcUser?: string
  loadingPrimary: boolean
  onRemoveDataserver: (code: string) => void
  onOpenAddDialog: () => void
  onLoadTables: LoadTables
}

/** TBC user for the "sem permissão" messages deep in the tab tree, without prop-drilling it. */
const TbcUserContext = createContext<string | undefined>(undefined)

function LoadingNotice({ text = "Carregando campos..." }: { text?: string }) {
  return (
    <p className="flex items-center gap-2 pt-3 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      {text}
    </p>
  )
}

function ErrorNotice({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 pt-3 text-sm text-destructive">
      <span>{error}</span>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-2 h-3 w-3" />
        Tentar novamente
      </Button>
    </div>
  )
}

/** Shows the related table once loaded, a spinner while loading (or not requested yet — the tab
 *  change that requests it has just fired), the "sem permissão" message when TOTVS refused access,
 *  or any other error with a retry. */
function LoadStateView({
  dataserver,
  state,
  onRetry,
  children,
}: {
  dataserver: AddedDataserver
  state: TableLoadState | undefined
  onRetry: () => void
  children: (result: ChecklistTableResult) => ReactNode
}) {
  const tbcUser = useContext(TbcUserContext)
  if (!state || state.status === "loading") return <LoadingNotice />
  if (state.status === "error" && state.permissionDenied) {
    return (
      <div className="pt-3">
        <PermissionDeniedAlert tbcUser={tbcUser} dataservers={[{ code: dataserver.code, name: dataserver.name }]} />
      </div>
    )
  }
  if (state.status === "error") return <ErrorNotice error={state.error} onRetry={onRetry} />
  return <>{children(state.result)}</>
}

/** Generic view: one tab per table of the Data Server. The main table comes already loaded; every
 *  related table loads on its first open (ReadRecord per main-table row). */
function TablesView({ dataserver, onLoadTables }: { dataserver: AddedDataserver; onLoadTables: LoadTables }) {
  const [activeTable, setActiveTable] = useState(dataserver.mainTable)

  if (dataserver.tables.length === 1) {
    return <RecordsView result={dataserver.mainResult} />
  }

  function handleTabChange(value: string) {
    setActiveTable(value)
    if (value !== dataserver.mainTable) onLoadTables(dataserver, [value])
  }

  return (
    <Tabs value={activeTable} onValueChange={(value) => handleTabChange(String(value))}>
      <TabsList className="h-auto flex-wrap">
        {dataserver.tables.map((table) => (
          <TabsTrigger key={table.name} value={table.name}>
            {table.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {dataserver.tables.map((table) => (
        <TabsContent key={table.name} value={table.name}>
          {table.name === dataserver.mainTable ? (
            <RecordsView result={dataserver.mainResult} />
          ) : (
            <RelatedTableView
              dataserver={dataserver}
              table={table.name}
              onRetry={() => onLoadTables(dataserver, [table.name])}
            />
          )}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** A related table across every parent row: under a single parent (the processo) it renders
 *  directly; under several (e.g. one per área ofertada) each parent becomes an accordion item. */
function RelatedTableView({
  dataserver,
  table,
  onRetry,
}: {
  dataserver: AddedDataserver
  table: string
  onRetry: () => void
}) {
  const states = dataserver.relatedStates[table] ?? {}
  if (dataserver.parents.length === 1) {
    return (
      <LoadStateView dataserver={dataserver} state={states[dataserver.parents[0].key]} onRetry={onRetry}>
        {(result) => <RecordsView result={result} />}
      </LoadStateView>
    )
  }
  return (
    <Accordion defaultValue={[]} className="pt-3">
      {dataserver.parents.map((parent) => (
        <AccordionItem key={parent.key} value={parent.key}>
          <AccordionTrigger>{parent.label}</AccordionTrigger>
          <AccordionContent>
            <LoadStateView dataserver={dataserver} state={states[parent.key]} onRetry={onRetry}>
              {(result) => <RecordsView result={result} />}
            </LoadStateView>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** Data Servers with a screen layout (`CHECKLIST_LAYOUTS` — Processo Seletivo, Área Ofertada): the
 *  same tabs the TOTVS RM screen has, each split in titled sections; with several main-table rows
 *  (each área) every row gets its own accordion item. Related tables load when their tab opens,
 *  for that row only. */
function LayoutView({
  dataserver,
  layout,
  onLoadTables,
}: {
  dataserver: AddedDataserver
  layout: LayoutTab[]
  onLoadTables: LoadTables
}) {
  const tabs = buildLayoutTabs(layout, dataserver.tables, dataserver.mainTable)
  if (dataserver.parents.length === 0) {
    return <p className="pt-3 text-sm text-muted-foreground">Nenhum registro encontrado no TOTVS.</p>
  }
  // A single record (the processo seletivo itself) goes straight to its tabs — an accordion with one
  // item would just be an extra click.
  if (dataserver.parents.length === 1) {
    return <ParentLayoutTabs dataserver={dataserver} parent={dataserver.parents[0]} tabs={tabs} onLoadTables={onLoadTables} />
  }
  return (
    <Accordion defaultValue={[]} className="rounded-md border px-3">
      {dataserver.parents.map((parent) => (
        <AccordionItem key={parent.key} value={parent.key}>
          <AccordionTrigger>{parent.label}</AccordionTrigger>
          <AccordionContent>
            <ParentLayoutTabs dataserver={dataserver} parent={parent} tabs={tabs} onLoadTables={onLoadTables} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

function ParentLayoutTabs({
  dataserver,
  parent,
  tabs,
  onLoadTables,
}: {
  dataserver: AddedDataserver
  parent: ChecklistParent
  tabs: LayoutTab[]
  onLoadTables: LoadTables
}) {
  const [activeTab, setActiveTab] = useState(tabs[0]?.name ?? "")
  const mainRecord = dataserver.mainResult.records.find((r) => r.key === parent.key)

  const relatedTablesOf = (tab: LayoutTab | undefined) =>
    Array.from(new Set((tab?.sections ?? []).map((s) => s.table).filter((t) => t !== dataserver.mainTable)))

  function loadTab(name: string) {
    const tables = relatedTablesOf(tabs.find((t) => t.name === name))
    if (tables.length) onLoadTables(dataserver, tables, [parent.key])
  }

  function handleTabChange(value: string) {
    setActiveTab(value)
    loadTab(value)
  }

  return (
    <Tabs value={activeTab} onValueChange={(value) => handleTabChange(String(value))}>
      {parent.error && (
        <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Registro completo indisponível ({parent.error}) — exibindo só os campos da visão.
        </p>
      )}
      <TabsList className="h-auto flex-wrap">
        {tabs.map((tab) => (
          <TabsTrigger key={tab.name} value={tab.name}>
            {tab.name}
          </TabsTrigger>
        ))}
      </TabsList>
      {tabs.map((tab) => (
        <TabsContent key={tab.name} value={tab.name} className="flex flex-col gap-4 pt-1">
          {tab.sections.map((section, index) => (
            <LayoutSectionView
              key={`${section.table}-${index}`}
              dataserver={dataserver}
              parent={parent}
              mainRecord={mainRecord}
              section={section}
              onRetry={() => onLoadTables(dataserver, [section.table], [parent.key])}
            />
          ))}
        </TabsContent>
      ))}
    </Tabs>
  )
}

/** Fields of `record` named in `fieldNames` (case-insensitive), in that order. */
function pickFields(record: ChecklistRecord, fieldNames: string[]): ChecklistRecord["fields"] {
  return fieldNames.flatMap((name) => {
    const field = record.fields.find((f) => f.name.toLowerCase() === name.toLowerCase())
    return field ? [field] : []
  })
}

function LayoutSectionView({
  dataserver,
  parent,
  mainRecord,
  section,
  onRetry,
}: {
  dataserver: AddedDataserver
  parent: ChecklistParent
  mainRecord: ChecklistRecord | undefined
  section: LayoutSection
  onRetry: () => void
}) {
  let body: ReactNode
  if (section.table === dataserver.mainTable) {
    body = mainRecord ? <CardsGrid fields={section.fields ? pickFields(mainRecord, section.fields) : mainRecord.fields} /> : null
  } else {
    body = (
      <LoadStateView dataserver={dataserver} state={dataserver.relatedStates[section.table]?.[parent.key]} onRetry={onRetry}>
        {(result) =>
          section.view === "fieldMatrix" ? (
            <FieldVisibilityMatrix result={result} />
          ) : section.fields ? (
            // A one-row parameters table (e.g. SPSParametrosAreaOfertada): its picked fields only.
            <CardsGrid fields={pickFields(result.records[0], section.fields)} />
          ) : (
            <RecordsView result={result} emptyText="Nenhum registro no TOTVS." rowLabel={section.rowLabel} />
          )
        }
      </LoadStateView>
    )
  }
  return (
    <section className="flex flex-col">
      {section.title && <h4 className="text-sm font-medium text-muted-foreground">{section.title}</h4>}
      {body}
    </section>
  )
}

/** "<NOME> (ID <id>)" from the row's own columns — falls back to the server-built label. */
function labelFromRow(record: ChecklistRecord, rowLabel: { name: string; id: string }): string {
  const value = (name: string) => record.fields.find((f) => f.name.toUpperCase() === name.toUpperCase())?.valor.trim() ?? ""
  const name = value(rowLabel.name)
  const id = value(rowLabel.id)
  if (!name) return record.label
  return id ? `${name} (ID ${id})` : name
}

/** A table with a single row shows its fields directly; more than one (e.g. N documentos
 *  exigidos) — or any number, with `rowLabel` (e.g. formas de inscrição) — becomes a
 *  collapsed-by-default accordion, one item per row. An empty table shows its fields as "Não
 *  configurado" under a notice, unless `emptyText` replaces them. */
function RecordsView({
  result,
  emptyText,
  rowLabel,
}: {
  result: ChecklistTableResult
  emptyText?: string
  rowLabel?: { name: string; id: string }
}) {
  if (result.empty && emptyText) {
    return <p className="pt-3 text-sm text-muted-foreground">{emptyText}</p>
  }
  const emptyNotice = result.empty && (
    <p className="pt-3 text-xs text-muted-foreground">Nenhum registro encontrado no TOTVS para esta tabela.</p>
  )
  if (result.records.length === 1 && (!rowLabel || result.empty)) {
    return (
      <>
        {emptyNotice}
        <CardsGrid fields={result.records[0].fields} />
      </>
    )
  }
  return (
    <Accordion defaultValue={[]} className="pt-3">
      {result.records.map((record) => (
        <AccordionItem key={record.key} value={record.key}>
          <AccordionTrigger>{rowLabel ? labelFromRow(record, rowLabel) : record.label}</AccordionTrigger>
          <AccordionContent>
            <CardsGrid fields={record.fields} />
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}

/** Wrapping flex row (not a CSS grid): each card is at least 1/3 of the row wide — so never more
 *  than 3 per row — and grows to fit its caption; when one wraps to the next line, the cards left
 *  on the row grow to take the space it freed. `items-start` keeps an opened card from stretching
 *  its row neighbours. Fields hidden by `visibleFields` (zeroed integers etc.) get no card. */
function CardsGrid({ fields }: { fields: ChecklistRecord["fields"] }) {
  return (
    <div className="flex flex-wrap items-start gap-3 pt-3">
      {visibleFields(fields).map((field) => (
        <ChecklistFieldCard key={`${field.table}-${field.name}`} field={field} />
      ))}
    </div>
  )
}

/** Layout view when the Data Server has a screen mapping, generic per-table tabs otherwise. */
function DataserverView({ dataserver, onLoadTables }: { dataserver: AddedDataserver; onLoadTables: LoadTables }) {
  const layout = CHECKLIST_LAYOUTS[dataserver.code]
  return (
    <div className="flex flex-col gap-2">
      {dataserver.truncated && (
        <p className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3.5 w-3.5" />
          Muitos registros encontrados — exibindo só os {dataserver.parents.length} primeiros. Preencha mais campos da chave
          para refinar.
        </p>
      )}
      {layout && dataserver.parents.length > 0 ? (
        <LayoutView dataserver={dataserver} layout={layout} onLoadTables={onLoadTables} />
      ) : (
        <TablesView dataserver={dataserver} onLoadTables={onLoadTables} />
      )}
    </div>
  )
}

export function ChecklistContent({
  selectedProcesso,
  addedDataservers,
  deniedDataservers,
  tbcUser,
  loadingPrimary,
  onRemoveDataserver,
  onOpenAddDialog,
  onLoadTables,
}: ChecklistContentProps) {
  if (!selectedProcesso) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-md border text-center text-muted-foreground">
        <ClipboardList className="h-10 w-10" />
        <p className="max-w-xs text-sm">
          Selecione um processo seletivo ao lado para ver o checklist de campos configurados no TOTVS.
        </p>
      </div>
    )
  }

  return (
    <TbcUserContext.Provider value={tbcUser}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Processo: {selectedProcesso.label}</h2>
          <Button type="button" size="sm" onClick={onOpenAddDialog}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Data Server
          </Button>
        </div>

        {addedDataservers.length === 0 && loadingPrimary && <LoadingNotice text="Carregando checklist..." />}

        <PermissionDeniedAlert tbcUser={tbcUser} dataservers={deniedDataservers} />

        {addedDataservers.length === 0 && deniedDataservers.length === 0 && !loadingPrimary && (
          <p className="text-sm text-muted-foreground">
            Nenhum Data Server adicionado ainda. Clique em &quot;Adicionar Data Server&quot; para começar o checklist.
          </p>
        )}

        {addedDataservers.length === 1 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{addedDataservers[0].name}</p>
              <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveDataserver(addedDataservers[0].code)} title="Remover">
                <X className="h-4 w-4" />
              </Button>
            </div>
            <DataserverView key={addedDataservers[0].id} dataserver={addedDataservers[0]} onLoadTables={onLoadTables} />
          </div>
        )}

        {addedDataservers.length > 1 && (
          <Tabs defaultValue={addedDataservers[0].code}>
            <TabsList>
              {addedDataservers.map((ds) => (
                <TabsTrigger key={ds.code} value={ds.code}>
                  {ds.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {addedDataservers.map((ds) => (
              <TabsContent key={ds.code} value={ds.code}>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => onRemoveDataserver(ds.code)} title="Remover">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <DataserverView key={ds.id} dataserver={ds} onLoadTables={onLoadTables} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </TbcUserContext.Provider>
  )
}
