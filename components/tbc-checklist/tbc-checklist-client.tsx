"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchDataserverChecklist, type ChecklistContext, type ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import { ProcessoSeletivoSidebar, type ProcessoSeletivo } from "@/components/tbc-checklist/processo-seletivo-sidebar"
import { AddDataserverDialog } from "@/components/tbc-checklist/add-dataserver-dialog"
import { ChecklistContent } from "@/components/tbc-checklist/checklist-content"
import type { TbcRow } from "@/services/tbc.service"
import type { Dataserver } from "@/generated/prisma/client"
import { toast } from "sonner"

export type AddedDataserver = {
  code: string
  name: string
  filtro: string
  tables: ChecklistTableResult[]
}

interface TbcChecklistClientProps {
  tbc: TbcRow
  dataservers: Dataserver[]
}

const DEFAULT_CONTEXT: ChecklistContext = { coligate: 1, branch: 1, levelEducation: 1 }

/** Filtro built from a processo's own PK fields, filled with its REAL values (unlike
 *  buildDefaultFiltro's blank template) — used to auto-load the checklist for the same Data
 *  Server that listed the processo, without asking the user to retype anything. */
function buildProcessoFiltro(processo: ProcessoSeletivo): string {
  if (!processo.pkFieldNames.length) return ""
  return processo.pkFieldNames
    .map((name) => `${processo.sourceTableName}.${name} = '${processo.row[name] ?? ""}'`)
    .join(" AND ")
}

/** CODCOLIGADA/CODFILIAL/CODTIPOCURSO from the shared Contexto, plus every field already known
 *  from the selected processo's own row (more specific — e.g. IDPS — so it wins on overlap). Used
 *  to pre-fill a newly added Data Server's filtro with real values instead of a blank template. */
function buildKnownValues(context: ChecklistContext, processo: ProcessoSeletivo | null): Record<string, string> {
  return {
    CODCOLIGADA: String(context.coligate),
    CODFILIAL: String(context.branch),
    CODTIPOCURSO: String(context.levelEducation),
    ...(processo?.row ?? {}),
  }
}

export function TbcChecklistClient({ tbc, dataservers }: TbcChecklistClientProps) {
  const [context, setContext] = useState<ChecklistContext>(DEFAULT_CONTEXT)
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoSeletivo | null>(null)
  const [addedDataservers, setAddedDataservers] = useState<AddedDataserver[]>([])
  const [primaryLoading, setPrimaryLoading] = useState(false)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  async function handleSelectProcesso(processo: ProcessoSeletivo | null) {
    setSelectedProcesso(processo)
    setAddedDataservers([])
    if (!processo || !processo.sourceDataserverCode) return

    const filtro = buildProcessoFiltro(processo)
    setPrimaryLoading(true)
    const result = await fetchDataserverChecklist({
      tbcId: tbc.id,
      dataserverCode: processo.sourceDataserverCode,
      filtro,
      context,
    })
    setPrimaryLoading(false)
    if (!result.success) {
      toast.error(result.error || `Falha ao carregar checklist do Data Server "${processo.sourceDataserverCode}"`)
      return
    }
    const meta = dataservers.find((d) => d.code === processo.sourceDataserverCode)
    setAddedDataservers([
      { code: processo.sourceDataserverCode, name: meta?.name ?? processo.sourceDataserverCode, filtro, tables: result.tables },
    ])
  }

  async function handleAddDataserver(dataserver: Dataserver, filtro: string) {
    setAddLoading(true)
    const result = await fetchDataserverChecklist({ tbcId: tbc.id, dataserverCode: dataserver.code, filtro, context })
    setAddLoading(false)
    if (!result.success) {
      toast.error(result.error || `Falha ao consultar o Data Server "${dataserver.name}"`)
      return
    }
    setAddedDataservers((prev) => [
      ...prev.filter((d) => d.code !== dataserver.code),
      { code: dataserver.code, name: dataserver.name, filtro, tables: result.tables },
    ])
    setAddDialogOpen(false)
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
          context={context}
          onContextChange={setContext}
        />

        <ChecklistContent
          selectedProcesso={selectedProcesso}
          addedDataservers={addedDataservers}
          loadingPrimary={primaryLoading}
          onRemoveDataserver={handleRemoveDataserver}
          onOpenAddDialog={() => setAddDialogOpen(true)}
        />
      </div>

      <AddDataserverDialog
        tbcId={tbc.id}
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        dataservers={dataservers}
        loading={addLoading}
        context={context}
        onContextChange={setContext}
        knownValues={buildKnownValues(context, selectedProcesso)}
        onConfirm={handleAddDataserver}
      />
    </div>
  )
}
