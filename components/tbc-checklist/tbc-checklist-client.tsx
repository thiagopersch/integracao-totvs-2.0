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
import { AREA_OFERTADA_DATASERVER } from "@/lib/tbc-checklist-dataservers"
import type { TbcRow } from "@/services/tbc.service"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

/** Load state of one related (child) table for one parent row — fetched lazily the first time a
 *  tab showing it opens. Absent from `relatedStates` = not requested yet. */
export type TableLoadState =
  | { status: "loading" }
  | { status: "error"; error: string }
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

export function TbcChecklistClient({ tbc, dataservers }: TbcChecklistClientProps) {
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoSeletivo | null>(null)
  const [addedDataservers, setAddedDataservers] = useState<AddedDataserver[]>([])
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
  ): Promise<AddedDataserver | null> {
    const result = await fetchChecklistMainTable({ tbcId: tbc.id, dataserverCode: code, pkValues, context })
    const meta = dataservers.find((d) => d.code === code)
    if (!result.success) {
      toast.error(result.error || `Falha ao carregar checklist do Data Server "${meta?.name ?? code}"`)
      return null
    }
    return {
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
  }

  /** Selecting a processo always loads its own Data Server plus the área ofertada one, both keyed
   *  by the processo's PK (coligada + IDPS) and the Contexto it was listed with. */
  async function handleSelectProcesso(processo: ProcessoSeletivo | null) {
    const selectionId = ++selectionRef.current
    setSelectedProcesso(processo)
    setAddedDataservers([])
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
    const loaded = await Promise.all(codes.map((code) => loadDataserver(code, processo.context, processo.pkValues)))
    if (selectionRef.current !== selectionId) return
    setPrimaryLoading(false)
    setAddedDataservers(loaded.filter((d): d is AddedDataserver => d !== null))
  }

  async function handleAddDataserver(dataserver: Dataserver, context: ChecklistContext, pkValues: Record<string, string>) {
    setAddLoading(true)
    const loaded = await loadDataserver(dataserver.code, context, pkValues)
    setAddLoading(false)
    if (!loaded) return
    setAddedDataservers((prev) => [...prev.filter((d) => d.code !== dataserver.code), loaded])
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
      if (!result.success) return { status: "error", error: result.error }
      const loaded = result.groups.find((g) => g.parentKey === parentKey)?.results[table]
      return loaded ? { status: "loaded", result: loaded } : { status: "error", error: "Registro não retornado pelo TOTVS." }
    })
  }

  function handleRemoveDataserver(code: string) {
    setAddedDataservers((prev) => prev.filter((d) => d.code !== code))
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link href="/admin/tbcs">
          <Button variant="ghost" size="icon" title="Voltar">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <ListChecks className="h-5 w-5" />
            Checklist de Configuração — TOTVS
          </h1>
          <p className="text-sm text-muted-foreground">
            Cliente: {tbc.client?.name ?? "-"} · TBC: {tbc.name}
          </p>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-4">
        <ProcessoSeletivoSidebar
          tbcId={tbc.id}
          dataservers={dataservers}
          selectedProcesso={selectedProcesso}
          onSelectProcesso={handleSelectProcesso}
        />

        <ChecklistContent
          selectedProcesso={selectedProcesso}
          addedDataservers={addedDataservers}
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
        onConfirm={handleAddDataserver}
      />
    </div>
  )
}
