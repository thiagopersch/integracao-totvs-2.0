"use client"

import { useState } from "react"
import dynamic from "next/dynamic"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { ExportPeriodSelect, isExportPeriodPending, toExportPeriod, type ExportPeriodSelection } from "@/components/shared/export-period-select"
import { exportDemandsXlsx, getDemandExportData } from "@/actions/export"
import type { Client } from "@/generated/prisma/client"
import { Loader2, FileSpreadsheet, FileText } from "lucide-react"
import { toast } from "sonner"

// jspdf + jspdf-autotable + html-to-image + the charts only load when a PDF is actually generated.
const DemandExportPdfBuilder = dynamic(
  () => import("@/components/shared/demand-export-pdf-builder").then((m) => m.DemandExportPdfBuilder),
  { ssr: false }
)

interface Props {
  clients: Client[]
  years: number[]
  monthsByYear: Record<number, number[]>
}

const ALL_CLIENTS_VALUE = "all"
const ALL_CLIENTS_LABEL = "Todos os clientes existentes"

type ClientSelection = { mode: "all" } | { mode: "custom"; ids: Set<string> }

export function DemandExportForm({ clients, years, monthsByYear }: Props) {
  const [clientSelection, setClientSelection] = useState<ClientSelection>({ mode: "all" })
  const [periodSelection, setPeriodSelection] = useState<ExportPeriodSelection>({ kind: "none" })
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [pdfExportData, setPdfExportData] = useState<Awaited<ReturnType<typeof getDemandExportData>> | null>(null)

  const period = toExportPeriod(periodSelection)
  const periodPending = isExportPeriodPending(periodSelection)
  const clientIds = clientSelection.mode === "all" ? [ALL_CLIENTS_VALUE] : Array.from(clientSelection.ids)

  const clientMultiSelectItems = [
    { value: ALL_CLIENTS_VALUE, label: ALL_CLIENTS_LABEL },
    ...clients.map((c) => ({ value: c.id, label: c.name, color: c.color })),
  ]

  function handleClientSelectionChange(next: string[]) {
    const hadAll = clientIds.includes(ALL_CLIENTS_VALUE)
    const hasAll = next.includes(ALL_CLIENTS_VALUE)
    // Picking "Todos os clientes existentes" always resets to "all", clearing any other selection —
    // it behaves like a radio even though it lives inside a checkbox multi-select.
    if (hasAll && !hadAll) {
      setClientSelection({ mode: "all" })
      return
    }
    const ids = new Set(next.filter((v) => v !== ALL_CLIENTS_VALUE))
    setClientSelection(ids.size === 0 ? { mode: "all" } : { mode: "custom", ids })
  }

  async function handleXlsx() {
    setLoadingXlsx(true)
    try {
      const result = await exportDemandsXlsx(clientIds, period)
      if (!result.success) {
        toast.error(result.error || "Erro ao exportar XLSX")
        return
      }
      const byteChars = atob(result.base64)
      const bytes = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i)
      const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.fileName
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoadingXlsx(false)
    }
  }

  async function handlePdf() {
    setLoadingPdf(true)
    const result = await getDemandExportData(clientIds, period)
    if (!result.success) {
      toast.error(result.error || "Erro ao exportar PDF")
      setLoadingPdf(false)
      return
    }
    setPdfExportData(result)
  }

  const selectedClientName =
    clientSelection.mode === "all"
      ? ALL_CLIENTS_LABEL
      : clients
          .filter((c) => clientSelection.ids.has(c.id))
          .map((c) => c.name)
          .join(", ")

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label>Cliente(s)</Label>
        <MultiSelect
          items={clientMultiSelectItems}
          value={clientIds}
          onValueChange={handleClientSelectionChange}
          placeholder="Selecione o(s) cliente(s)"
          searchPlaceholder="Buscar cliente..."
          emptyText="Nenhum cliente encontrado."
        />
      </div>

      <div className="space-y-2">
        <Label>Período</Label>
        <ExportPeriodSelect years={years} monthsByYear={monthsByYear} value={periodSelection} onChange={setPeriodSelection} />
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleXlsx} disabled={loadingXlsx || periodPending}>
          {loadingXlsx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
          Exportar XLSX
        </Button>
        <Button type="button" onClick={handlePdf} disabled={loadingPdf || periodPending}>
          {loadingPdf ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileText className="h-4 w-4 mr-2" />}
          Exportar PDF
        </Button>
      </div>

      {pdfExportData?.success && (
        <DemandExportPdfBuilder
          data={pdfExportData}
          clientLabel={selectedClientName}
          onDone={() => {
            setPdfExportData(null)
            setLoadingPdf(false)
          }}
        />
      )}
    </div>
  )
}
