"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ComboboxItem } from "@/components/ui/combobox"
import { DemandImportReviewDialog } from "@/components/shared/demand-import-review-dialog"
import { parseDemandImport } from "@/actions/import"
import type { ParsedDemandRow } from "@/schemas/demand-import.schema"
import type { Client, Analyst, Requester, Department, DemandType } from "@/generated/prisma/client"

interface Props {
  clients: Client[]
  analysts: Analyst[]
  requesters: Requester[]
  departments: Department[]
  demandTypes: DemandType[]
  /** Called after a successful import, in addition to the automatic table refresh — lets a
   *  wrapping dialog (e.g. the Demands page toolbar) close itself. */
  onClose?: () => void
}

function toItems(records: { id: string; name: string }[]): ComboboxItem[] {
  return records.map((r) => ({ value: r.id, label: r.name }))
}

export function DemandImportForm({ clients, analysts, requesters, departments, demandTypes, onClose }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [parsedRows, setParsedRows] = useState<ParsedDemandRow[]>([])
  const [fileName, setFileName] = useState("")

  const clientItems = toItems(clients)
  const analystItems = toItems(analysts)
  const requesterItems = toItems(requesters)
  const departmentItems = toItems(departments)
  const demandTypeItems = toItems(demandTypes)

  async function handleAnalyze() {
    if (!file) {
      toast.error("Selecione um arquivo para importar")
      return
    }
    setLoading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const result = await parseDemandImport(formData)
      if (!result.success) {
        toast.error(result.error || "Erro ao analisar arquivo")
        return
      }
      setParsedRows(result.rows)
      setFileName(result.fileName)
      setReviewOpen(true)
    } finally {
      setLoading(false)
    }
  }

  function handleImported() {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
    router.refresh()
    onClose?.()
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label htmlFor="import-file">Planilha de demandas</Label>
        <Input
          id="import-file"
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          Aceita o formato da exportação de demandas ou planilhas de apontamento de horas (ex: modelo de parceiros), com colunas
          Data, Cliente, Analista, Solicitante, Setor, Demanda, Descrição e Horas. Planilhas com várias abas (uma por mês) são
          combinadas automaticamente.
        </p>
      </div>

      <Button type="button" onClick={handleAnalyze} disabled={loading || !file}>
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileUp className="h-4 w-4 mr-2" />}
        Analisar arquivo
      </Button>

      <DemandImportReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        fileName={fileName}
        parsedRows={parsedRows}
        clients={clientItems}
        analysts={analystItems}
        requesters={requesterItems}
        departments={departmentItems}
        demandTypes={demandTypeItems}
        onImported={handleImported}
      />
    </div>
  )
}
