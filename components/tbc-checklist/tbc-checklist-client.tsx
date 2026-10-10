"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ClipboardList, ListChecks, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  fetchChecklistRelatedTable,
  type ChecklistContext,
  type ChecklistParent,
  type ChecklistTableMeta,
  type ChecklistTableResult,
} from "@/actions/integrations/tbc-checklist"
import {
  addTbcChecklistProcessos,
  removeTbcChecklistDataserver,
  removeTbcChecklistProcesso,
  saveTbcChecklistDataserverFields,
  saveTbcChecklistListing,
} from "@/actions/integrations/tbc-checklist-templates"
import {
  ProcessoSeletivoSidebar,
  type ProcessoSearchSetup,
  type ProcessoSeletivo,
} from "@/components/tbc-checklist/processo-seletivo-sidebar"
import { DataserverFieldsDialog, type DataserverFieldsDialogMode } from "@/components/tbc-checklist/dataserver-fields-dialog"
import { ChecklistSelector } from "@/components/tbc-checklist/checklist-selector"
import { ChecklistContent } from "@/components/tbc-checklist/checklist-content"
import { loadMainTable } from "@/components/tbc-checklist/checklist-loader"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import type { DeniedDataserver } from "@/components/tbc-checklist/permission-denied-alert"
import {
  EMPTY_CONTEXT_FORM,
  PROCESSO_SELETIVO_DATASERVER,
  toChecklistContext,
  type ChecklistContextForm,
} from "@/lib/tbc-checklist-dataservers"
import { checklistSelection, type ChecklistSelection } from "@/lib/tbc-checklist-selection"
import { isFinished, type DataserverLoadProgress } from "@/lib/tbc-checklist-progress"
import type { ProcessoSeletivoOption } from "@/lib/tbc-checklist-processos"
import type { TbcChecklistField } from "@/schemas/tbc-checklist.schema"
import type { TbcChecklistImportSource, TbcChecklistView } from "@/services/tbc-checklist.service"
import type { TbcRow } from "@/services/tbc.service"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"
import { WithTooltip } from "@/components/shared/with-tooltip"

/** Load state of one related (child) table for one parent row — fetched lazily the first time a
 *  tab showing it opens. Absent from `relatedStates` = not requested yet. */
export type TableLoadState =
  | { status: "loading" }
  | { status: "error"; error: string; permissionDenied?: boolean }
  | { status: "loaded"; result: ChecklistTableResult }

export type AddedDataserver = {
  /** Unique per load — guards late responses from a Data Server that was since removed/reloaded. */
  id: string
  code: string
  name: string
  context: ChecklistContext
  mainTable: string
  /** Values the main table was filtered by (e.g. CODCOLIGADA + IDPS), re-checked on child rows. */
  matchValues: Record<string, string>
  tables: ChecklistTableMeta[]
  mainResult: ChecklistTableResult
  parents: ChecklistParent[]
  /** More rows matched than were loaded (see MAX_PARENTS in the action). */
  truncated: boolean
  /** table name → parent key → state. */
  relatedStates: Record<string, Record<string, TableLoadState>>
  /** Fields the active checklist validates for this Data Server — the only ones shown. */
  selection: ChecklistSelection
}

interface TbcChecklistClientProps {
  tbc: TbcRow
  dataservers: Dataserver[]
  checklists: TbcChecklistView[]
  /** `?checklist=` of the URL — falls back to the most recently changed checklist. */
  initialChecklistId?: string
}

let loadCounter = 0

type LoadOutcome =
  | { kind: "loaded"; dataserver: AddedDataserver }
  | { kind: "denied"; denied: DeniedDataserver }
  | { kind: "failed" }
  | { kind: "cancelled" }

type CachedProcesso = { added: AddedDataserver[]; denied: DeniedDataserver[] }

/** How long the finished progress bar stays on screen before it goes away. */
const PROGRESS_HIDE_DELAY_MS = 1000

/** Adds `denied` to the list (once per code). */
function withDenied(list: DeniedDataserver[], denied: DeniedDataserver): DeniedDataserver[] {
  return [...list.filter((d) => d.code !== denied.code), denied]
}

function contextFormOf(checklist: TbcChecklistView): ChecklistContextForm {
  const text = (value: number | null) => (value === null ? "" : String(value))
  return {
    coligate: text(checklist.coligateContext),
    branch: text(checklist.branchContext),
    levelEducation: text(checklist.levelEducationContext),
  }
}

function searchSetupOf(checklist: TbcChecklistView) {
  return { dataserverCode: checklist.listingDataserverCode, context: contextFormOf(checklist) }
}

/** Keeps `?checklist=` in sync without a navigation (the checklists already live in this state). */
function syncChecklistParam(id: string | null) {
  const url = new URL(window.location.href)
  if (id) url.searchParams.set("checklist", id)
  else url.searchParams.delete("checklist")
  window.history.replaceState(null, "", url)
}

export function TbcChecklistClient({ tbc, dataservers, checklists: initialChecklists, initialChecklistId }: TbcChecklistClientProps) {
  const [checklists, setChecklists] = useState(initialChecklists)
  const [activeId, setActiveId] = useState<string | null>(
    () => initialChecklists.find((c) => c.id === initialChecklistId)?.id ?? initialChecklists[0]?.id ?? null
  )
  const [createRequest, setCreateRequest] = useState(0)
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoSeletivo | null>(null)
  const [addedDataservers, setAddedDataservers] = useState<AddedDataserver[]>([])
  // Data Servers TOTVS refused the TBC user access to — shown as a message instead of fields.
  const [deniedDataservers, setDeniedDataservers] = useState<DeniedDataserver[]>([])
  // Per Data Server load progress of the current processo — null when nothing is loading. Mirrored
  // in a ref so each step builds on the latest value and can tell when everything settled.
  const [loadProgress, setLoadProgressState] = useState<DataserverLoadProgress[] | null>(null)
  const progressRef = useRef<DataserverLoadProgress[] | null>(null)
  const [fieldsDialog, setFieldsDialog] = useState<DataserverFieldsDialogMode | null>(null)
  // Remounts the dialog on every open, so it always starts from the checklist's saved state.
  const [fieldsDialogKey, setFieldsDialogKey] = useState(0)
  const [savingFields, setSavingFields] = useState(false)
  const [removingCode, setRemovingCode] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const selectionRef = useRef(0)
  // "dataserverId|table|parentKey" requests on their way — sections that ask for their own table in
  // the same render all see the same (stale) relatedStates, so this keeps them from duplicating.
  const inFlightRef = useRef(new Set<string>())
  // Loaded cards of the processos that are NOT on screen, by processo id — reopening one shows them
  // without going back to TOTVS. Cleared whenever the checklist structure changes.
  const cacheRef = useRef(new Map<string, CachedProcesso>())

  const active = checklists.find((c) => c.id === activeId) ?? null
  const nameOf = (code: string) => dataservers.find((d) => d.code === code)?.name ?? code

  function replaceChecklist(checklist: TbcChecklistView) {
    setChecklists((prev) => [checklist, ...prev.filter((c) => c.id !== checklist.id)])
  }

  function resetLoaded() {
    selectionRef.current++
    setSelectedProcesso(null)
    setAddedDataservers([])
    setDeniedDataservers([])
    setLoadProgress(null)
  }

  function clearCache() {
    cacheRef.current.clear()
  }

  /** Keeps the processo on screen in the cache — only once every Data Server of the checklist has
   *  loaded (or been refused), so a failed one is fetched again next time. Related tables still
   *  loading are dropped; their tab requests them again when opened. */
  function stashCurrent() {
    if (!selectedProcesso || !active) return
    const settled = new Set([...addedDataservers.map((d) => d.code), ...deniedDataservers.map((d) => d.code)])
    if (!active.dataservers.every((d) => settled.has(d.dataserverCode))) return
    const added = addedDataservers.map((d) => ({
      ...d,
      relatedStates: Object.fromEntries(
        Object.entries(d.relatedStates).map(([table, byParent]) => [
          table,
          Object.fromEntries(Object.entries(byParent).filter(([, state]) => state.status !== "loading")),
        ])
      ),
    }))
    cacheRef.current.set(selectedProcesso.id, { added, denied: deniedDataservers })
  }

  function handleSelectChecklist(id: string | null) {
    if (id === activeId) return
    clearCache()
    resetLoaded()
    setActiveId(id)
    syncChecklistParam(id)
  }

  const isCurrent = (selectionId: number) => () => selectionRef.current === selectionId

  function setLoadProgress(next: DataserverLoadProgress[] | null) {
    progressRef.current = next
    setLoadProgressState(next)
  }

  function updateProgress(selectionId: number, code: string, patch: Partial<DataserverLoadProgress>) {
    if (selectionRef.current !== selectionId || !progressRef.current) return
    const next = progressRef.current.map((p) => (p.code === code ? { ...p, ...patch } : p))
    setLoadProgress(next)
    // Everything settled: keep the full bar on screen for a moment, then drop it.
    if (next.every(isFinished)) {
      setTimeout(() => {
        if (selectionRef.current === selectionId && progressRef.current?.every(isFinished)) setLoadProgress(null)
      }, PROGRESS_HIDE_DELAY_MS)
    }
  }

  /** Loads one Data Server's main table (view, then its records in batches), reporting every step
   *  to the progress bar. */
  async function loadDataserver(
    code: string,
    context: ChecklistContext,
    pkValues: Record<string, string>,
    fields: TbcChecklistField[],
    selectionId: number
  ): Promise<LoadOutcome> {
    updateProgress(selectionId, code, { phase: "view" })
    const result = await loadMainTable(
      { tbcId: tbc.id, dataserverCode: code, pkValues, context },
      (done, total) => updateProgress(selectionId, code, { phase: "records", done, total }),
      isCurrent(selectionId)
    )
    if (!result.success) {
      if (result.cancelled) return { kind: "cancelled" }
      updateProgress(selectionId, code, { phase: "failed" })
      if (result.permissionDenied) return { kind: "denied", denied: { code, name: nameOf(code) } }
      toast.error(result.error || `Falha ao carregar checklist do Data Server "${nameOf(code)}"`)
      return { kind: "failed" }
    }
    updateProgress(selectionId, code, { phase: "done" })
    const dataserver: AddedDataserver = {
      id: `${code}-${++loadCounter}`,
      code,
      name: nameOf(code),
      context,
      mainTable: result.mainTable,
      matchValues: result.matchValues,
      tables: result.tables,
      mainResult: result.mainResult,
      parents: result.parents,
      truncated: result.truncated,
      relatedStates: {},
      selection: checklistSelection(fields, result.tables),
    }
    return { kind: "loaded", dataserver }
  }

  /** Shows a finished load right away, keeping the Data Servers in checklist order. */
  function publish(outcome: LoadOutcome, code: string, order: string[], selectionId: number) {
    if (selectionRef.current !== selectionId) return
    const rank = (c: string) => {
      const index = order.indexOf(c)
      return index === -1 ? order.length : index
    }
    if (outcome.kind === "loaded") {
      setAddedDataservers((prev) =>
        [...prev.filter((d) => d.code !== code), outcome.dataserver].sort((a, b) => rank(a.code) - rank(b.code))
      )
      setDeniedDataservers((prev) => prev.filter((d) => d.code !== code))
    } else if (outcome.kind === "denied") {
      setAddedDataservers((prev) => prev.filter((d) => d.code !== code))
      setDeniedDataservers((prev) => withDenied(prev, outcome.denied))
    }
  }

  /**
   * The first Data Server of the checklist (the processo seletivo one) is loaded on its own and
   * shown as soon as it returns; only then the others start, side by side, each shown as it
   * arrives. A failure in one never stops the rest.
   */
  async function loadDataservers(
    entries: TbcChecklistView["dataservers"],
    processo: ProcessoSeletivo,
    order: string[],
    selectionId: number
  ) {
    const run = async (entry: TbcChecklistView["dataservers"][number]) => {
      const outcome = await loadDataserver(entry.dataserverCode, processo.context, processo.pkValues, entry.fields, selectionId)
      publish(outcome, entry.dataserverCode, order, selectionId)
    }
    const [first, ...rest] = entries
    if (!first) return
    await run(first)
    if (selectionRef.current !== selectionId) return
    await Promise.all(rest.map(run))
  }

  /** Selecting a processo loads every Data Server of the checklist (the active one unless given —
   *  e.g. its just-imported state), keyed by the processo's PK (coligada + IDPS) and the Contexto
   *  it was saved with. A processo seen before comes from the cache unless `force` (Atualizar). */
  async function handleSelectProcesso(
    processo: ProcessoSeletivo | null,
    checklist: TbcChecklistView | null = active,
    { force = false }: { force?: boolean } = {}
  ) {
    // Clicking the processo already on screen keeps it as is — "Atualizar" is the way to refetch.
    if (!force && processo && processo.id === selectedProcesso?.id) return
    const selectionId = ++selectionRef.current
    if (processo?.id !== selectedProcesso?.id) stashCurrent()
    setSelectedProcesso(processo)
    const cached = processo && !force ? cacheRef.current.get(processo.id) : undefined
    if (processo) cacheRef.current.delete(processo.id)
    if (cached) {
      setAddedDataservers(cached.added)
      setDeniedDataservers(cached.denied)
      setLoadProgress(null)
      return
    }
    setAddedDataservers([])
    setDeniedDataservers([])
    if (!processo || !checklist || !checklist.dataservers.length) {
      setLoadProgress(null)
      return
    }
    setLoadProgress(
      checklist.dataservers.map((d) => ({ code: d.dataserverCode, name: nameOf(d.dataserverCode), phase: "waiting", done: 0, total: 0 }))
    )
    const order = checklist.dataservers.map((d) => d.dataserverCode)
    await loadDataservers(checklist.dataservers, processo, order, selectionId)
  }

  function handleRefreshProcesso(processo: ProcessoSeletivo) {
    void handleSelectProcesso(processo, active, { force: true })
  }

  /** Drops every cached processo; the one on screen is fetched again now, the others when opened. */
  function handleRefreshAll() {
    clearCache()
    if (selectedProcesso) handleRefreshProcesso(selectedProcesso)
    toast.success("Os dados de todos os processos seletivos serão buscados novamente no TOTVS")
  }

  /** Keeps the Data Server + Contexto of the last processo search, to pre-fill the next one. */
  async function handleSearched(setup: ProcessoSearchSetup) {
    if (!active || JSON.stringify(setup) === JSON.stringify(searchSetupOf(active))) return
    const toInt = (value: string) => (value.trim() === "" ? null : Number(value))
    const result = await saveTbcChecklistListing(active.id, {
      coligateContext: toInt(setup.context.coligate),
      branchContext: toInt(setup.context.branch),
      levelEducationContext: toInt(setup.context.levelEducation),
      listingDataserverCode: setup.dataserverCode,
      listingIdFields: active.listingIdFields,
      listingLabelField: active.listingLabelField,
    })
    if (!result.success) {
      toast.error(`Não foi possível salvar a configuração no checklist: ${result.error}`)
      return
    }
    replaceChecklist(result.data)
  }

  async function handleAddProcessos(processos: ProcessoSeletivoOption[]): Promise<boolean> {
    if (!active) return false
    const result = await addTbcChecklistProcessos(active.id, { processos })
    if (!result.success) {
      toast.error(result.error)
      return false
    }
    replaceChecklist(result.data)
    toast.success(
      processos.length === 1 ? "Processo seletivo adicionado ao checklist" : `${processos.length} processos seletivos adicionados ao checklist`
    )
    return true
  }

  async function handleRemoveProcesso(id: string) {
    if (!active) return
    const result = await removeTbcChecklistProcesso(active.id, id)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    replaceChecklist(result.data)
    cacheRef.current.delete(id)
    if (selectedProcesso?.id === id) resetLoaded()
    toast.success("Processo seletivo removido do checklist")
  }

  function openFieldsDialog(mode: DataserverFieldsDialogMode) {
    setFieldsDialogKey((k) => k + 1)
    setFieldsDialog(mode)
  }

  async function handleSaveFields(code: string, fields: TbcChecklistField[], contextForm: ChecklistContextForm) {
    if (!active) return
    setSavingFields(true)
    const result = await saveTbcChecklistDataserverFields(active.id, { dataserverCode: code, fields })
    if (!result.success) {
      setSavingFields(false)
      toast.error(result.error)
      return
    }
    const saved = await withSavedContext(result.data, contextForm)
    replaceChecklist(saved)
    // Cached processos were loaded with the old field selection.
    clearCache()
    setSavingFields(false)
    setFieldsDialog(null)
    toast.success("Campos do checklist salvos")

    const loaded = addedDataservers.some((d) => d.code === code)
    if (loaded) {
      setAddedDataservers((prev) => prev.map((d) => (d.code === code ? { ...d, selection: checklistSelection(fields, d.tables) } : d)))
    } else if (selectedProcesso) {
      // A Data Server new to this processo's screen: load it with its own progress entry.
      const selectionId = selectionRef.current
      const entry = saved.dataservers.find((d) => d.dataserverCode === code)
      if (!entry) return
      setLoadProgress([
        ...(progressRef.current ?? []).filter((p) => p.code !== code),
        { code, name: nameOf(code), phase: "waiting", done: 0, total: 0 },
      ])
      await loadDataservers([entry], selectedProcesso, saved.dataservers.map((d) => d.dataserverCode), selectionId)
    }
  }

  /** A checklist with no Contexto yet keeps the one its first fields were fetched with (plus the
   *  processo-seletivo Data Server as listing), so the sidebar — shown once a Data Server is
   *  configured — comes pre-filled and lists the processos by itself. */
  async function withSavedContext(checklist: TbcChecklistView, contextForm: ChecklistContextForm): Promise<TbcChecklistView> {
    const context = toChecklistContext(contextForm)
    if (checklist.coligateContext !== null || !context) return checklist
    const listingDataserverCode =
      checklist.listingDataserverCode ??
      (dataservers.some((d) => d.code === PROCESSO_SELETIVO_DATASERVER) ? PROCESSO_SELETIVO_DATASERVER : null)
    const result = await saveTbcChecklistListing(checklist.id, {
      coligateContext: context.coligate,
      branchContext: context.branch,
      levelEducationContext: context.levelEducation,
      listingDataserverCode,
      listingIdFields: checklist.listingIdFields,
      listingLabelField: checklist.listingLabelField,
    })
    if (!result.success) {
      toast.error(`Não foi possível salvar o contexto no checklist: ${result.error}`)
      return checklist
    }
    return result.data
  }

  async function handleRemoveDataserver() {
    if (!active || !removingCode) return
    const code = removingCode
    setRemoving(true)
    const result = await removeTbcChecklistDataserver(active.id, code)
    setRemoving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    replaceChecklist(result.data)
    clearCache()
    if (!result.data.dataservers.length) {
      // Back to "not configured": the processo listing hides until a Data Server is added again.
      resetLoaded()
    } else {
      setAddedDataservers((prev) => prev.filter((d) => d.code !== code))
      setDeniedDataservers((prev) => prev.filter((d) => d.code !== code))
    }
    setRemovingCode(null)
    toast.success("Data Server removido do checklist")
  }

  function setRelatedStates(dataserverId: string, tables: string[], parentKeys: string[], stateFor: (table: string, parentKey: string) => TableLoadState) {
    setAddedDataservers((prev) =>
      prev.map((d) => {
        if (d.id !== dataserverId) return d
        const relatedStates = { ...d.relatedStates }
        for (const table of tables) {
          relatedStates[table] = { ...relatedStates[table] }
          for (const parentKey of parentKeys) relatedStates[table][parentKey] = stateFor(table, parentKey)
        }
        return { ...d, relatedStates }
      })
    )
  }

  /** Loads `tableNames` for `parentKeys` (default: every parent) — only the combinations not
   *  loaded/loading yet, in one ReadRecord per parent for all of its tables. */
  async function handleLoadTables(dataserver: AddedDataserver, tableNames: string[], parentKeys = dataserver.parents.map((p) => p.key)) {
    const flightKey = (table: string, parentKey: string) => `${dataserver.id}|${table}|${parentKey}`
    const pending = (table: string, parentKey: string) => {
      const status = dataserver.relatedStates[table]?.[parentKey]?.status
      return status !== "loading" && status !== "loaded" && !inFlightRef.current.has(flightKey(table, parentKey))
    }
    const tables = dataserver.tables.filter(
      (t) => tableNames.includes(t.name) && t.name !== dataserver.mainTable && parentKeys.some((key) => pending(t.name, key))
    )
    const parents = dataserver.parents.filter((p) => parentKeys.includes(p.key) && tables.some((t) => pending(t.name, p.key)))
    if (!tables.length || !parents.length) return

    const tableList = tables.map((t) => t.name)
    const parentList = parents.map((p) => p.key)
    const keys = tableList.flatMap((table) => parentList.map((parentKey) => flightKey(table, parentKey)))
    keys.forEach((key) => inFlightRef.current.add(key))
    setRelatedStates(dataserver.id, tableList, parentList, () => ({ status: "loading" }))
    const result = await fetchChecklistRelatedTable({
      tbcId: tbc.id,
      dataserverCode: dataserver.code,
      tables,
      parents,
      matchValues: dataserver.matchValues,
      context: dataserver.context,
    })
    keys.forEach((key) => inFlightRef.current.delete(key))
    setRelatedStates(dataserver.id, tableList, parentList, (table, parentKey) => {
      if (!result.success) return { status: "error", error: result.error, permissionDenied: result.permissionDenied }
      const loaded = result.groups.find((g) => g.parentKey === parentKey)?.results[table]
      return loaded ? { status: "loaded", result: loaded } : { status: "error", error: "Registro não retornado pelo TOTVS." }
    })
  }

  const dialogContext = selectedProcesso
    ? {
        coligate: String(selectedProcesso.context.coligate),
        branch: String(selectedProcesso.context.branch),
        levelEducation: String(selectedProcesso.context.levelEducation),
      }
    : active
      ? contextFormOf(active)
      : EMPTY_CONTEXT_FORM

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/admin/tbcs">
          <WithTooltip label="Voltar">
            <Button variant="ghost" size="icon" aria-label="Voltar">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </WithTooltip>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-base font-semibold sm:text-lg">
            <ListChecks className="h-5 w-5 shrink-0" />
            Checklist de Configuração — TOTVS
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente: {tbc.client?.name ?? "-"} · TBC: {tbc.name}
          </p>
        </div>
      </div>

      <ChecklistSelector
        tbcId={tbc.id}
        checklists={checklists}
        activeId={activeId}
        onSelect={handleSelectChecklist}
        onSaved={(checklist) => {
          replaceChecklist(checklist)
          handleSelectChecklist(checklist.id)
        }}
        onImported={(checklist: TbcChecklistView, source: TbcChecklistImportSource) => {
          replaceChecklist(checklist)
          toast.success(`Estrutura importada de "${source.name}"`)
          // Cards on screen follow the new structure.
          clearCache()
          if (selectedProcesso) void handleSelectProcesso(selectedProcesso, checklist, { force: true })
        }}
        onDeleted={(id) => {
          const remaining = checklists.filter((c) => c.id !== id)
          setChecklists(remaining)
          clearCache()
          resetLoaded()
          setActiveId(remaining[0]?.id ?? null)
          syncChecklistParam(remaining[0]?.id ?? null)
        }}
        createRequest={createRequest}
      />

      {!active ? (
        <div className="flex min-h-48 flex-1 flex-col items-center justify-center gap-3 rounded-md border p-4 text-center text-muted-foreground">
          <ClipboardList className="h-10 w-10" />
          <p className="max-w-sm text-sm">
            {checklists.length
              ? "Selecione um checklist acima para começar."
              : "Este TBC ainda não tem checklist. Crie um e escolha os campos de cada Data Server que devem ser validados."}
          </p>
          {!checklists.length && (
            <Button type="button" onClick={() => setCreateRequest((n) => n + 1)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar checklist
            </Button>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
          {/* Processos are only listed once the checklist has a Data Server with fields to validate. */}
          {active.dataservers.length > 0 && (
            <ProcessoSeletivoSidebar
              key={active.id}
              tbcId={tbc.id}
              dataservers={dataservers}
              processos={active.processos}
              selectedProcesso={selectedProcesso}
              onSelectProcesso={handleSelectProcesso}
              tbcUser={tbc.user}
              initialSearch={searchSetupOf(active)}
              onSearched={handleSearched}
              onAddProcessos={handleAddProcessos}
              onRemoveProcesso={handleRemoveProcesso}
              onRefreshProcesso={handleRefreshProcesso}
              onRefreshAll={handleRefreshAll}
            />
          )}

          <ChecklistContent
            checklist={active}
            dataserverName={nameOf}
            selectedProcesso={selectedProcesso}
            addedDataservers={addedDataservers}
            deniedDataservers={deniedDataservers}
            tbcUser={tbc.user}
            loadProgress={loadProgress}
            onRemoveDataserver={setRemovingCode}
            onEditFields={(code) =>
              openFieldsDialog({ kind: "edit", code, fields: active.dataservers.find((d) => d.dataserverCode === code)?.fields ?? [] })
            }
            onOpenAddDialog={() => openFieldsDialog({ kind: "add" })}
            onRefreshProcesso={() => selectedProcesso && handleRefreshProcesso(selectedProcesso)}
            onLoadTables={handleLoadTables}
          />
        </div>
      )}

      {fieldsDialog && active && (
        <DataserverFieldsDialog
          key={fieldsDialogKey}
          tbcId={tbc.id}
          open
          onOpenChange={(open) => !open && setFieldsDialog(null)}
          mode={fieldsDialog}
          dataservers={dataservers}
          usedCodes={active.dataservers.map((d) => d.dataserverCode)}
          initialContext={dialogContext}
          saving={savingFields}
          tbcUser={tbc.user}
          onConfirm={(code, fields, context) => void handleSaveFields(code, fields, context)}
        />
      )}

      <ConfirmDialog
        open={removingCode !== null}
        onOpenChange={(open) => !open && setRemovingCode(null)}
        title="Remover Data Server do checklist"
        description={`"${removingCode ? nameOf(removingCode) : ""}" e os campos escolhidos para ele deixarão de fazer parte deste checklist.`}
        confirmLabel="Remover"
        variant="destructive"
        loading={removing}
        loadingLabel="Removendo..."
        onConfirm={() => void handleRemoveDataserver()}
      />
    </div>
  )
}
