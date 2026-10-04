"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  fetchChecklistMainTable,
  fetchChecklistRelatedTable,
  type ChecklistContext,
  type ChecklistParent,
  type ChecklistTableMeta,
  type ChecklistTableResult,
} from "@/actions/integrations/tbc-checklist"
import { ProcessoSeletivoSidebar, type ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import { AddDataserverDialog } from "@/components/tbc-checklist/add-dataserver-dialog"
import { ChecklistContent } from "@/components/tbc-checklist/checklist-content"
import type { DeniedDataserver } from "@/components/tbc-checklist/permission-denied-alert"
import { AREA_OFERTADA_DATASERVER } from "@/lib/tbc-checklist-dataservers"
import type { TbcRow } from "@/services/tbc.service"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

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
}

interface TbcChecklistClientProps {
  tbc: TbcRow
  dataservers: Dataserver[]
}

let loadCounter = 0

type LoadOutcome =
  | { kind: "loaded"; dataserver: AddedDataserver }
  | { kind: "denied"; denied: DeniedDataserver }
  | { kind: "failed" }

/** Adds `denied` to the list (once per code). */
function withDenied(list: DeniedDataserver[], denied: DeniedDataserver): DeniedDataserver[] {
  return [...list.filter((d) => d.code !== denied.code), denied]
}

export function TbcChecklistClient({ tbc, dataservers }: TbcChecklistClientProps) {
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoSeletivo | null>(null)
  const [addedDataservers, setAddedDataservers] = useState<AddedDataserver[]>([])
  // Data Servers TOTVS refused the TBC user access to — shown as a message instead of fields.
  const [deniedDataservers, setDeniedDataservers] = useState<DeniedDataserver[]>([])
  const [primaryLoading, setPrimaryLoading] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  // Remounts the dialog on every open, so it always starts empty (also after a successful add,
  // which closes it from here rather than through its own reset path).
  const [addDialogKey, setAddDialogKey] = useState(0)
  const [addLoading, setAddLoading] = useState(false)
  const selectionRef = useRef(0)

  async function loadDataserver(
    code: string,
    context: ChecklistContext,
    pkValues: Record<string, string>
  ): Promise<LoadOutcome> {
    const result = await fetchChecklistMainTable({ tbcId: tbc.id, dataserverCode: code, pkValues, context })
    const meta = dataservers.find((d) => d.code === code)
    if (!result.success) {
      if (result.permissionDenied) return { kind: "denied", denied: { code, name: meta?.name ?? code } }
      toast.error(result.error || `Falha ao carregar checklist do Data Server "${meta?.name ?? code}"`)
      return { kind: "failed" }
    }
    const dataserver: AddedDataserver = {
      id: `${code}-${++loadCounter}`,
      code,
      name: meta?.name ?? code,
      context,
      mainTable: result.mainTable,
      matchValues: result.appliedFilter,
      tables: result.tables,
      mainResult: result.mainResult,
      parents: result.parents,
      truncated: result.truncated,
      relatedStates: {},
    }
    return { kind: "loaded", dataserver }
  }

  /** Selecting a processo always loads its own Data Server plus the área ofertada one, both keyed
   *  by the processo's PK (coligada + IDPS) and the Contexto it was listed with. */
  async function handleSelectProcesso(processo: ProcessoSeletivo | null) {
    const selectionId = ++selectionRef.current
    setSelectedProcesso(processo)
    setAddedDataservers([])
    setDeniedDataservers([])
    if (!processo || !processo.sourceDataserverCode) {
      setPrimaryLoading(false)
      return
    }

    const codes = [processo.sourceDataserverCode]
    if (
      processo.sourceDataserverCode !== AREA_OFERTADA_DATASERVER &&
      dataservers.some((d) => d.code === AREA_OFERTADA_DATASERVER)
    ) {
      codes.push(AREA_OFERTADA_DATASERVER)
    }

    setPrimaryLoading(true)
    const outcomes = await Promise.all(codes.map((code) => loadDataserver(code, processo.context, processo.pkValues)))
    if (selectionRef.current !== selectionId) return
    setPrimaryLoading(false)
    setAddedDataservers(outcomes.flatMap((o) => (o.kind === "loaded" ? [o.dataserver] : [])))
    setDeniedDataservers(outcomes.flatMap((o) => (o.kind === "denied" ? [o.denied] : [])))
  }

  async function handleAddDataserver(dataserver: Dataserver, context: ChecklistContext, pkValues: Record<string, string>) {
    setAddLoading(true)
    const outcome = await loadDataserver(dataserver.code, context, pkValues)
    setAddLoading(false)
    if (outcome.kind === "failed") return
    if (outcome.kind === "denied") {
      setAddedDataservers((prev) => prev.filter((d) => d.code !== dataserver.code))
      setDeniedDataservers((prev) => withDenied(prev, outcome.denied))
    } else {
      setAddedDataservers((prev) => [...prev.filter((d) => d.code !== dataserver.code), outcome.dataserver])
      setDeniedDataservers((prev) => prev.filter((d) => d.code !== dataserver.code))
    }
    setAddDialogOpen(false)
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
    const pending = (table: string, parentKey: string) => {
      const status = dataserver.relatedStates[table]?.[parentKey]?.status
      return status !== "loading" && status !== "loaded"
    }
    const tables = dataserver.tables.filter(
      (t) => tableNames.includes(t.name) && t.name !== dataserver.mainTable && parentKeys.some((key) => pending(t.name, key))
    )
    const parents = dataserver.parents.filter((p) => parentKeys.includes(p.key) && tables.some((t) => pending(t.name, p.key)))
    if (!tables.length || !parents.length) return

    const tableList = tables.map((t) => t.name)
    const parentList = parents.map((p) => p.key)
    setRelatedStates(dataserver.id, tableList, parentList, () => ({ status: "loading" }))
    const result = await fetchChecklistRelatedTable({
      tbcId: tbc.id,
      dataserverCode: dataserver.code,
      tables,
      parents,
      matchValues: dataserver.matchValues,
      context: dataserver.context,
    })
    setRelatedStates(dataserver.id, tableList, parentList, (table, parentKey) => {
      if (!result.success) return { status: "error", error: result.error, permissionDenied: result.permissionDenied }
      const loaded = result.groups.find((g) => g.parentKey === parentKey)?.results[table]
      return loaded ? { status: "loaded", result: loaded } : { status: "error", error: "Registro não retornado pelo TOTVS." }
    })
  }

  function handleRemoveDataserver(code: string) {
    setAddedDataservers((prev) => prev.filter((d) => d.code !== code))
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Link href="/admin/tbcs">
          <Button variant="ghost" size="icon" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
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

      <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-row">
        <ProcessoSeletivoSidebar
          tbcId={tbc.id}
          dataservers={dataservers}
          selectedProcesso={selectedProcesso}
          onSelectProcesso={handleSelectProcesso}
          tbcUser={tbc.user}
        />

        <ChecklistContent
          selectedProcesso={selectedProcesso}
          addedDataservers={addedDataservers}
          deniedDataservers={deniedDataservers}
          tbcUser={tbc.user}
          loadingPrimary={primaryLoading}
          onRemoveDataserver={handleRemoveDataserver}
          onOpenAddDialog={() => {
            setAddDialogKey((k) => k + 1)
            setAddDialogOpen(true)
          }}
          onLoadTables={handleLoadTables}
        />
      </div>

      <AddDataserverDialog
        key={addDialogKey}
        tbcId={tbc.id}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        dataservers={dataservers}
        loading={addLoading}
        knownValues={selectedProcesso?.pkValues ?? {}}
        tbcUser={tbc.user}
        onConfirm={handleAddDataserver}
      />
    </div>
  )
}
