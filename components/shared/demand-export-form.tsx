"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PeriodSelect } from "@/components/shared/period-select"
import { DemandExportPdfBuilder } from "@/components/shared/demand-export-pdf-builder"
import { exportDemandsXlsx, getDemandExportData } from "@/actions/export"
import type { Period } from "@/lib/period"
import type { Client } from "@/generated/prisma/client"
import { Loader2, FileSpreadsheet, FileText } from "lucide-react"
import { toast } from "sonner"

interface Props {
  clients: Client[]
  years: number[]
  monthsByYear: Record<number, number[]>
}

const ALL_CLIENTS_VALUE = "all"
const ALL_CLIENTS_LABEL = "Todos os clientes ativos e com contrato vigente"

export function DemandExportForm({ clients, years, monthsByYear }: Props) {
  const [clientId, setClientId] = useState(ALL_CLIENTS_VALUE)
  const [period, setPeriod] = useState<Period | null>(null)
  const [loadingXlsx, setLoadingXlsx] = useState(false)
  const [loadingPdf, setLoadingPdf] = useState(false)
  const [pdfExportData, setPdfExportData] = useState<Awaited<ReturnType<typeof getDemandExportData>> | null>(null)

  async function handleXlsx() {
    setLoadingXlsx(true)
    try {
      const result = await exportDemandsXlsx(clientId, period)
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
    const result = await getDemandExportData(clientId, period)
    if (!result.success) {
      toast.error(result.error || "Erro ao exportar PDF")
      setLoadingPdf(false)
      return
    }
    setPdfExportData(result)
  }

  const selectedClientName = clientId === ALL_CLIENTS_VALUE ? ALL_CLIENTS_LABEL : clients.find((c) => c.id === clientId)?.name || ""

  return (
    <div className="max-w-xl space-y-6">
      <div className="space-y-2">
        <Label>Cliente</Label>
        <Select
          items={[{ value: ALL_CLIENTS_VALUE, label: ALL_CLIENTS_LABEL }, ...clients.map((c) => ({ value: c.id, label: c.name }))]}
          value={clientId}
          onValueChange={(v) => setClientId(v || ALL_CLIENTS_VALUE)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_CLIENTS_VALUE}>{ALL_CLIENTS_LABEL}</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Período</Label>
        <PeriodSelect years={years} monthsByYear={monthsByYear} value={period} onChange={setPeriod} />
        <p className="text-xs text-muted-foreground">Deixe em branco para exportar todos os períodos.</p>
      </div>

      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={handleXlsx} disabled={loadingXlsx}>
          {loadingXlsx ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 mr-2" />}
          Exportar XLSX
        </Button>
        <Button type="button" onClick={handlePdf} disabled={loadingPdf}>
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
