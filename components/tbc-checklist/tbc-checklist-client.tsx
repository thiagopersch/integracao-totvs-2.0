"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowLeft, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { fetchDataserverChecklist, type ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
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

export function TbcChecklistClient({ tbc, dataservers }: TbcChecklistClientProps) {
  const [selectedProcesso, setSelectedProcesso] = useState<ProcessoSeletivo | null>(null)
  const [addedDataservers, setAddedDataservers] = useState<AddedDataserver[]>([])
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addLoading, setAddLoading] = useState(false)

  function handleSelectProcesso(processo: ProcessoSeletivo | null) {
    setSelectedProcesso(processo)
    setAddedDataservers([])
  }

  async function handleAddDataserver(dataserver: Dataserver, filtro: string) {
    setAddLoading(true)
    const result = await fetchDataserverChecklist({ tbcId: tbc.id, dataserverCode: dataserver.code, filtro })
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
        />

        <ChecklistContent
          selectedProcesso={selectedProcesso}
          addedDataservers={addedDataservers}
          onRemoveDataserver={handleRemoveDataserver}
          onOpenAddDialog={() => setAddDialogOpen(true)}
        />
      </div>

      <AddDataserverDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        dataservers={dataservers}
        loading={addLoading}
        onConfirm={handleAddDataserver}
      />
    </div>
  )
}
