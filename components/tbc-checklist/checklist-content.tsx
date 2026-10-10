"use client"

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { AlertTriangle, ListPlus, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollableTabsList, Tabs, TabsContent, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ChecklistFieldCard } from "@/components/tbc-checklist/checklist-field-card"
import { FieldVisibilityMatrix } from "@/components/tbc-checklist/field-visibility-matrix"
import { visibleFields } from "@/lib/tbc-checklist-field-rules"
import { filterLayoutTabs, filterSelectedFields, hasSelectedField, type ChecklistSelection } from "@/lib/tbc-checklist-selection"
import { PermissionDeniedAlert, type DeniedDataserver } from "@/components/tbc-checklist/permission-denied-alert"
import { buildLayoutTabs, CHECKLIST_LAYOUTS, type LayoutSection, type LayoutTab } from "@/lib/tbc-checklist-layouts"
import type { AddedDataserver, TableLoadState } from "@/components/tbc-checklist/tbc-checklist-client"
import type { ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import type { ChecklistParent, ChecklistRecord, ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import type { TbcChecklistView } from "@/services/tbc-checklist.service"
import { ChecklistLoadProgress } from "@/components/tbc-checklist/checklist-load-progress"
import { describeStep, isFinished, type DataserverLoadProgress } from "@/lib/tbc-checklist-progress"

type LoadTables = (dataserver: AddedDataserver, tables: string[], parentKeys?: string[]) => void

interface ChecklistContentProps {
  /** Active saved checklist — which Data Servers (and fields) are validated. */
  checklist: TbcChecklistView
  dataserverName: (code: string) => string
  selectedProcesso: ProcessoSeletivo | null
  addedDataservers: AddedDataserver[]
  /** Data Servers TOTVS refused the TBC user access to — listed in a red message. */
  deniedDataservers: DeniedDataserver[]
  /** TBC user the SOAP calls run as, named in that message. */
  tbcUser?: string
  /** Load progress per Data Server of the selected processo — null when nothing is loading. */
  loadProgress: DataserverLoadProgress[] | null
  /** Asks to remove the Data Server from the checklist (the caller confirms). */
  onRemoveDataserver: (code: string) => void
  onEditFields: (code: string) => void
  onOpenAddDialog: () => void
  onLoadTables: LoadTables
}

/** TBC user for the "sem permissão" messages deep in the tab tree, without prop-drilling it. */
const TbcUserContext = createContext<string | undefined>(undefined)

/** Fields the checklist validates for the Data Server being rendered — `CardsGrid` shows only those. */
const SelectionContext = createContext<ChecklistSelection | undefined>(undefined)

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
  // A section shown before its table was requested (first tab on mount, fields added later) asks
  // for it itself; already loading/loaded combinations are skipped by the loader.
  const missing = state === undefined
  const requestRef = useRef(onRetry)
  useEffect(() => {
    requestRef.current = onRetry
  })
  useEffect(() => {
    if (missing) requestRef.current()
  }, [missing])
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
  const tables = dataserver.tables.filter((t) => hasSelectedField(dataserver.selection, t.name))
  const [chosenTable, setActiveTable] = useState(tables[0]?.name ?? dataserver.mainTable)
  // The chosen tab may have lost all its fields in a later "Editar campos".
  const activeTable = tables.some((t) => t.name === chosenTable) ? chosenTable : (tables[0]?.name ?? "")

  if (!tables.length) return <NoSelectedFields />
  if (tables.length === 1 && tables[0].name === dataserver.mainTable) {
    return <RecordsView result={dataserver.mainResult} />
  }

  function handleTabChange(value: string) {
    setActiveTable(value)
    if (value !== dataserver.mainTable) onLoadTables(dataserver, [value])
  }

  return (
    <Tabs value={activeTable} onValueChange={(value) => handleTabChange(String(value))}>
      <ScrollableTabsList>
        {tables.map((table) => (
          <TabsTrigger key={table.name} value={table.name}>
            {table.name}
          </TabsTrigger>
        ))}
      </ScrollableTabsList>
      {tables.map((table) => (
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
    <RecordCards
      items={dataserver.parents.map((parent) => ({
        key: parent.key,
        label: parent.label,
        content: (
          <LoadStateView dataserver={dataserver} state={states[parent.key]} onRetry={onRetry}>
            {(result) => <RecordsView result={result} />}
          </LoadStateView>
        ),
      }))}
    />
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
  const tabs = filterLayoutTabs(buildLayoutTabs(layout, dataserver.tables, dataserver.mainTable), dataserver.selection)
  if (dataserver.parents.length === 0) {
    return <p className="pt-3 text-sm text-muted-foreground">Nenhum registro encontrado no TOTVS.</p>
  }
  if (!tabs.length) return <NoSelectedFields />
  // A single record (the processo seletivo itself) goes straight to its tabs — an accordion with one
  // item would just be an extra click.
  if (dataserver.parents.length === 1) {
    return <ParentLayoutTabs dataserver={dataserver} parent={dataserver.parents[0]} tabs={tabs} onLoadTables={onLoadTables} />
  }
  return (
    <RecordCards
      items={dataserver.parents.map((parent) => ({
        key: parent.key,
        label: parent.label,
        content: <ParentLayoutTabs dataserver={dataserver} parent={parent} tabs={tabs} onLoadTables={onLoadTables} />,
      }))}
    />
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
  const [chosenTab, setActiveTab] = useState(tabs[0]?.name ?? "")
  // The chosen tab may have lost all its fields in a later "Editar campos".
  const activeTab = tabs.some((t) => t.name === chosenTab) ? chosenTab : (tabs[0]?.name ?? "")
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
      <ScrollableTabsList>
        {tabs.map((tab) => (
          <TabsTrigger key={tab.name} value={tab.name}>
            {tab.name}
          </TabsTrigger>
        ))}
      </ScrollableTabsList>
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
 *  exigidos) — or any number, with `rowLabel` (e.g. formas de inscrição) — becomes a list of
 *  collapsed-by-default cards, one per row. An empty table shows its fields as "Não
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
  const labelOf = (record: ChecklistRecord) => (rowLabel ? labelFromRow(record, rowLabel) : record.label)
  // Several rows — or a labelled one (e.g. a single forma de inscrição): one card each.
  return (
    <RecordCards
      items={result.records.map((record) => ({ key: record.key, label: labelOf(record), content: <CardsGrid fields={record.fields} /> }))}
    />
  )
}

/** Rows of one table (áreas ofertadas, formas de inscrição, documentos exigidos…): each one a
 *  separate, collapsed-by-default card, spaced apart with a soft shadow. */
function RecordCards({ items }: { items: { key: string; label: ReactNode; content: ReactNode }[] }) {
  return (
    <Accordion defaultValue={[]} className="flex flex-col gap-3 pt-3">
      {items.map((item) => (
        <AccordionItem
          key={item.key}
          value={item.key}
          className="overflow-hidden rounded-lg border bg-card shadow-sm transition-shadow last:border-b hover:shadow-md data-open:shadow-md"
        >
          <AccordionTrigger className="items-center rounded-none px-4 py-3 hover:bg-muted/40 hover:no-underline">{item.label}</AccordionTrigger>
          <AccordionContent className="border-t px-4 pt-1 pb-4">{item.content}</AccordionContent>
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
  const selection = useContext(SelectionContext)
  const shown = selection ? filterSelectedFields(fields, selection) : visibleFields(fields)
  if (!shown.length) return <p className="pt-3 text-xs text-muted-foreground">Nenhum campo selecionado para esta tabela.</p>
  return (
    <div className="flex flex-wrap items-start gap-3 pt-3">
      {shown.map((field) => (
        <ChecklistFieldCard key={`${field.table}-${field.name}`} field={field} />
      ))}
    </div>
  )
}

function NoSelectedFields() {
  return (
    <p className="pt-3 text-sm text-muted-foreground">
      Nenhum campo selecionado para este Data Server. Use &quot;Editar campos&quot; para escolher o que validar.
    </p>
  )
}

/** Edit-fields / remove buttons of one Data Server of the checklist. */
function DataserverActions({ code, onEditFields, onRemove }: { code: string; onEditFields: (code: string) => void; onRemove: (code: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Button type="button" variant="outline" size="sm" onClick={() => onEditFields(code)}>
        <ListPlus className="mr-2 h-4 w-4" />
        Editar campos
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="destructive" size="icon" onClick={() => onRemove(code)} aria-label="Remover do checklist">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>Remover do checklist</TooltipContent>
      </Tooltip>
    </div>
  )
}

/** Layout view when the Data Server has a screen mapping, generic per-table tabs otherwise. */
function DataserverView({ dataserver, onLoadTables }: { dataserver: AddedDataserver; onLoadTables: LoadTables }) {
  const layout = CHECKLIST_LAYOUTS[dataserver.code]
  return (
    <SelectionContext.Provider value={dataserver.selection}>
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
    </SelectionContext.Provider>
  )
}

/** The checklist's Data Servers and how many fields each validates — shown while no processo is
 *  selected, where the structure is managed. */
function ChecklistStructure({
  checklist,
  dataserverName,
  onEditFields,
  onRemoveDataserver,
}: Pick<ChecklistContentProps, "checklist" | "dataserverName" | "onEditFields" | "onRemoveDataserver">) {
  // Empty: the hint above the structure already says what to do.
  if (!checklist.dataservers.length) return null
  return (
    <ul className="flex flex-col divide-y rounded-md border">
      {checklist.dataservers.map((d) => (
        <li key={d.dataserverCode} className="flex flex-wrap items-center justify-between gap-2 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium break-words">{dataserverName(d.dataserverCode)}</p>
            <p className="text-xs text-muted-foreground">
              {d.dataserverCode} · {d.fields.length} {d.fields.length === 1 ? "campo" : "campos"}
            </p>
          </div>
          <DataserverActions code={d.dataserverCode} onEditFields={onEditFields} onRemove={onRemoveDataserver} />
        </li>
      ))}
    </ul>
  )
}

/** One Data Server slot of the processo's checklist: its data once loaded, or its load progress. */
type DataserverEntry = {
  code: string
  name: string
  dataserver?: AddedDataserver
  progress?: DataserverLoadProgress
}

function EntryView({ entry, onLoadTables }: { entry: DataserverEntry; onLoadTables: LoadTables }) {
  if (entry.dataserver) return <DataserverView key={entry.dataserver.id} dataserver={entry.dataserver} onLoadTables={onLoadTables} />
  return <LoadingNotice text={entry.progress ? describeStep(entry.progress) : "Carregando..."} />
}

export function ChecklistContent({
  checklist,
  dataserverName,
  selectedProcesso,
  addedDataservers,
  deniedDataservers,
  tbcUser,
  loadProgress,
  onRemoveDataserver,
  onEditFields,
  onOpenAddDialog,
  onLoadTables,
}: ChecklistContentProps) {
  const addButton = (
    <Button type="button" size="sm" onClick={onOpenAddDialog}>
      <Plus className="mr-2 h-4 w-4" />
      Adicionar Data Server
    </Button>
  )

  // Loaded Data Servers plus the ones still on their way, in checklist order — so the first one
  // shows its fields while the next tabs are still loading.
  const order = checklist.dataservers.map((d) => d.dataserverCode)
  const rank = (code: string) => {
    const index = order.indexOf(code)
    return index === -1 ? order.length : index
  }
  const pending = (loadProgress ?? []).filter((p) => !isFinished(p))
  const entries: DataserverEntry[] = Array.from(new Set([...addedDataservers.map((d) => d.code), ...pending.map((p) => p.code)]))
    .sort((a, b) => rank(a) - rank(b))
    .map((code) => {
      const dataserver = addedDataservers.find((d) => d.code === code)
      const progress = pending.find((p) => p.code === code)
      return { code, name: dataserver?.name ?? progress?.name ?? dataserverName(code), dataserver, progress }
    })

  if (!selectedProcesso) {
    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">{checklist.name}</h2>
          {addButton}
        </div>
        <p className="text-xs text-muted-foreground">
          {checklist.dataservers.length
            ? "Selecione um processo seletivo ao lado para validar no TOTVS os campos escolhidos abaixo."
            : "Adicione um Data Server e escolha os campos que devem ser validados. Depois disso, a busca de processos seletivos aparece ao lado."}
        </p>
        <ChecklistStructure
          checklist={checklist}
          dataserverName={dataserverName}
          onEditFields={onEditFields}
          onRemoveDataserver={onRemoveDataserver}
        />
      </div>
    )
  }

  return (
    <TbcUserContext.Provider value={tbcUser}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto rounded-md border p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Processo: {selectedProcesso.label}</h2>
          {addButton}
        </div>

        {loadProgress && <ChecklistLoadProgress items={loadProgress} />}

        <PermissionDeniedAlert tbcUser={tbcUser} dataservers={deniedDataservers} />

        {entries.length === 0 && deniedDataservers.length === 0 && !loadProgress && (
          <p className="text-sm text-muted-foreground">
            Nenhum Data Server neste checklist ainda. Clique em &quot;Adicionar Data Server&quot; e escolha os campos que devem ser
            validados.
          </p>
        )}

        {entries.length === 1 && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">{entries[0].name}</p>
              <DataserverActions code={entries[0].code} onEditFields={onEditFields} onRemove={onRemoveDataserver} />
            </div>
            <EntryView entry={entries[0]} onLoadTables={onLoadTables} />
          </div>
        )}

        {entries.length > 1 && (
          <Tabs defaultValue={entries[0].code}>
            <ScrollableTabsList>
              {entries.map((entry) => (
                <TabsTrigger key={entry.code} value={entry.code}>
                  {!entry.dataserver && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {entry.name}
                </TabsTrigger>
              ))}
            </ScrollableTabsList>
            {entries.map((entry) => (
              <TabsContent key={entry.code} value={entry.code}>
                <div className="flex flex-col gap-2">
                  <div className="flex justify-end">
                    <DataserverActions code={entry.code} onEditFields={onEditFields} onRemove={onRemoveDataserver} />
                  </div>
                  <EntryView entry={entry} onLoadTables={onLoadTables} />
                </div>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </TbcUserContext.Provider>
  )
}
