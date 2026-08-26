"use client"

import { useEffect, useState } from "react"
import axios from "axios"
import { toast } from "sonner"
import { FileBarChart2, Loader2, Download, ListChecks } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Progress } from "@/components/ui/progress"
import { useTbcReportStore, type ReportStepKey } from "@/store/tbc-report.store"
import type { RptReportPar } from "@/utils/tbc-report-parser"

type TbcOption = { id: string; name: string; link: string }

const BUDGET_MS = 120_000

function getParLabel(par: RptReportPar): string {
  const description = par["Description"]
  const paramName = par["ParamName"]
  const bandName = par["BandName"]
  if (typeof description === "string" && description) return description
  if (typeof paramName === "string" && paramName) return paramName
  if (typeof bandName === "string" && bandName) return bandName
  return "Item"
}

function getParValueText(par: RptReportPar): string {
  const value = par["Value"]
  if (typeof value === "string") return value
  if (value && typeof value === "object") return String((value as Record<string, unknown>)["#text"] ?? "")
  return ""
}

function setParValueText(par: RptReportPar, text: string): RptReportPar {
  const value = par["Value"]
  if (value && typeof value === "object") {
    return { ...par, Value: { ...(value as Record<string, unknown>), "#text": text } }
  }
  return { ...par, Value: text }
}

function mimeFromFileName(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "pdf": return "application/pdf"
    case "xls": return "application/vnd.ms-excel"
    case "xlsx": return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    case "doc": return "application/msword"
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    case "html": return "text/html"
    case "txt": return "text/plain"
    default: return "application/octet-stream"
  }
}

function downloadBase64(base64: string, fileName: string) {
  const byteChars = atob(base64)
  const byteNumbers = new Array(byteChars.length)
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i)
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: mimeFromFileName(fileName) })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function extractErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) return err.response?.data?.error || err.message
  return (err as Error).message
}

const STEP_ORDER: ReportStepKey[] = ["list", "info", "generate", "poll", "download"]

export function TbcReportsClient({ initialTbcs }: { initialTbcs: TbcOption[] }) {
  const tbcs = initialTbcs

  const selectedTbcId = useTbcReportStore((s) => s.selectedTbcId)
  const setSelectedTbcId = useTbcReportStore((s) => s.setSelectedTbcId)
  const codColigada = useTbcReportStore((s) => s.codColigada)
  const setCodColigada = useTbcReportStore((s) => s.setCodColigada)
  const reports = useTbcReportStore((s) => s.reports)
  const setReports = useTbcReportStore((s) => s.setReports)
  const selectedReport = useTbcReportStore((s) => s.selectedReport)
  const setSelectedReport = useTbcReportStore((s) => s.setSelectedReport)
  const reportInfo = useTbcReportStore((s) => s.reportInfo)
  const setReportInfo = useTbcReportStore((s) => s.setReportInfo)
  const filters = useTbcReportStore((s) => s.filters)
  const setFilters = useTbcReportStore((s) => s.setFilters)
  const parameters = useTbcReportStore((s) => s.parameters)
  const setParameters = useTbcReportStore((s) => s.setParameters)
  const fileName = useTbcReportStore((s) => s.fileName)
  const setFileName = useTbcReportStore((s) => s.setFileName)
  const steps = useTbcReportStore((s) => s.steps)
  const resetSteps = useTbcReportStore((s) => s.resetSteps)
  const updateStep = useTbcReportStore((s) => s.updateStep)
  const deadline = useTbcReportStore((s) => s.deadline)
  const setDeadline = useTbcReportStore((s) => s.setDeadline)
  const generationMode = useTbcReportStore((s) => s.generationMode)
  const setGenerationMode = useTbcReportStore((s) => s.setGenerationMode)
  const downloadResult = useTbcReportStore((s) => s.downloadResult)
  const setDownloadResult = useTbcReportStore((s) => s.setDownloadResult)
  const loading = useTbcReportStore((s) => s.loading)
  const setLoading = useTbcReportStore((s) => s.setLoading)

  const [progressValue, setProgressValue] = useState(0)

  useEffect(() => {
    if (!loading || !deadline) return

    const tick = () => {
      const remaining = Math.max(0, deadline - Date.now())
      setProgressValue(((BUDGET_MS - remaining) / BUDGET_MS) * 100)
    }
    const id = setInterval(tick, 500)
    return () => clearInterval(id)
  }, [loading, deadline])

  async function handleListReports() {
    if (!selectedTbcId) {
      toast.error("Selecione o TBC")
      return
    }
    setLoading(true)
    setSelectedReport(null)
    setReportInfo(null)
    try {
      const res = await axios.post("/api/tbc-reports/list", { tbcId: selectedTbcId, codColigada })
      setReports(res.data.reports)
      toast.success(`${res.data.reports.length} relatório(s) encontrado(s)`)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function handleSelectReport(codReport: string) {
    const report = reports.find((r) => r.codReport === codReport) || null
    setSelectedReport(report)
    setReportInfo(null)
    if (!report) return

    setLoading(true)
    try {
      const res = await axios.post("/api/tbc-reports/info", {
        tbcId: selectedTbcId,
        codColigada,
        codSistema: report.codSistema,
        codReport: report.codReport,
      })
      setReportInfo(res.data)
    } catch (err) {
      toast.error(extractErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function pollUntilDone(guid: string, budgetDeadline: number): Promise<string> {
    while (true) {
      const remaining = budgetDeadline - Date.now()
      if (remaining <= 0) throw new Error("Orçamento de 120s excedido durante a verificação de status")

      const res = await axios.post("/api/tbc-reports/status", {
        tbcId: selectedTbcId,
        guid,
        timeout: Math.min(remaining, 20_000),
      })
      const status = res.data as { status: "wait" | "done" | "error"; resultGuid?: string; message?: string }

      if (status.status === "done") return status.resultGuid || guid
      if (status.status === "error") throw new Error(status.message || "Erro ao gerar o relatório")

      await sleep(Math.min(2000, Math.max(500, budgetDeadline - Date.now())))
    }
  }

  async function handleGenerate() {
    if (!selectedTbcId || !selectedReport) {
      toast.error("Selecione o TBC e o relatório")
      return
    }

    const budgetDeadline = Date.now() + BUDGET_MS
    setDeadline(budgetDeadline)
    resetSteps()
    setDownloadResult(null)
    setGenerationMode(null)
    setLoading(true)

    let currentStep: ReportStepKey = "generate"
    const remaining = () => budgetDeadline - Date.now()

    try {
      updateStep("generate", { status: "running" })
      if (remaining() <= 0) throw new Error("Orçamento de 120s excedido antes de iniciar a geração")

      const genRes = await axios.post("/api/tbc-reports/generate", {
        tbcId: selectedTbcId,
        codColigada,
        codSistema: selectedReport.codSistema,
        codReport: selectedReport.codReport,
        fileName,
        filters,
        parameters,
        timeout: Math.min(remaining(), 20_000),
      })
      const { mode, guid } = genRes.data as { mode: "async" | "sync"; guid: string }
      setGenerationMode(mode)
      updateStep("generate", { status: "done", detail: mode === "async" ? "Assíncrono" : "Síncrono (fallback)" })

      let finalGuid = guid
      currentStep = "poll"
      if (mode === "async") {
        updateStep("poll", { status: "running" })
        if (remaining() <= 0) throw new Error("Orçamento de 120s excedido antes de verificar o status")
        finalGuid = await pollUntilDone(guid, budgetDeadline)
        updateStep("poll", { status: "done" })
      } else {
        updateStep("poll", { status: "done", detail: "Não necessário (síncrono)" })
      }

      currentStep = "download"
      updateStep("download", { status: "running" })
      if (remaining() <= 0) throw new Error("Orçamento de 120s excedido antes do download")

      const dlRes = await axios.post("/api/tbc-reports/download", {
        tbcId: selectedTbcId,
        guid: finalGuid,
        fileName,
        timeout: Math.min(remaining(), 20_000),
      })
      const result = dlRes.data as { base64: string; byteLength: number; fileName: string }
      setDownloadResult(result)
      updateStep("download", { status: "done" })

      if (result.base64) downloadBase64(result.base64, result.fileName || fileName)
      toast.success("Relatório gerado e baixado com sucesso")
    } catch (err) {
      const msg = extractErrorMessage(err)
      updateStep(currentStep, { status: "error", detail: msg })
      toast.error(msg)
    } finally {
      setLoading(false)
      setDeadline(null)
    }
  }

  function updateFilterValue(index: number, text: string) {
    setFilters(filters.map((f, i) => (i === index ? setParValueText(f, text) : f)))
  }

  function updateParameterValue(index: number, text: string) {
    setParameters(parameters.map((p, i) => (i === index ? setParValueText(p, text) : p)))
  }

  const hasFiltersOrParams = filters.length > 0 || parameters.length > 0

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold font-heading flex items-center gap-2">
          <FileBarChart2 className="h-5 w-5" /> Relatórios TBC
        </h1>
        <p className="text-sm text-muted-foreground">
          Gera relatórios TOTVS RM via TBC Web Services Reports — listar, configurar filtros/parâmetros, gerar e baixar.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Conexão</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="tbc">TBC</FieldLabel>
                <Combobox
                  items={tbcs.map((t) => ({ value: t.id, label: t.name }))}
                  value={selectedTbcId}
                  onValueChange={setSelectedTbcId}
                  placeholder="Selecionar TBC..."
                  searchPlaceholder="Buscar TBC..."
                  emptyText="Nenhum TBC encontrado."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="codColigada">Coligada</FieldLabel>
                <Input
                  id="codColigada"
                  type="number"
                  value={codColigada}
                  onChange={(e) => setCodColigada(Number(e.target.value))}
                />
              </Field>
              <div className="flex items-end">
                <Button type="button" onClick={handleListReports} disabled={loading} className="w-full">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ListChecks className="h-4 w-4 mr-2" />}
                  Listar relatórios
                </Button>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Relatório</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="report">Relatório</FieldLabel>
                <Combobox
                  items={reports.map((r) => ({ value: r.codReport, label: `${r.nome} (${r.codReport})` }))}
                  value={selectedReport?.codReport ?? null}
                  onValueChange={handleSelectReport}
                  placeholder="Selecionar relatório..."
                  searchPlaceholder="Buscar relatório..."
                  emptyText="Liste os relatórios primeiro."
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="fileName">Nome do arquivo</FieldLabel>
                <Input id="fileName" value={fileName} onChange={(e) => setFileName(e.target.value)} placeholder="Relatorio.pdf" />
              </Field>
            </div>

            {selectedReport && reportInfo && !hasFiltersOrParams && (
              <p className="text-sm text-muted-foreground">Este relatório não possui filtros ou parâmetros configuráveis.</p>
            )}

            {filters.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Filtros</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {filters.map((f, i) => (
                    <Field key={i}>
                      <FieldLabel>{getParLabel(f)}</FieldLabel>
                      <Input value={getParValueText(f)} onChange={(e) => updateFilterValue(i, e.target.value)} />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            {parameters.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Parâmetros</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {parameters.map((p, i) => (
                    <Field key={i}>
                      <FieldLabel>{getParLabel(p)}</FieldLabel>
                      <Input value={getParValueText(p)} onChange={(e) => updateParameterValue(i, e.target.value)} />
                    </Field>
                  ))}
                </div>
              </div>
            )}

            <Button type="button" onClick={handleGenerate} disabled={loading || !selectedReport}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileBarChart2 className="h-4 w-4 mr-2" />}
              Gerar relatório
            </Button>
          </fieldset>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm flex items-center justify-between">
            <span>Progresso da geração</span>
            {generationMode && <Badge variant="outline">{generationMode === "async" ? "Assíncrono" : "Síncrono (fallback)"}</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {deadline && <Progress value={progressValue} />}
          <ScrollArea className="h-[220px] rounded-lg border border-input p-3">
            <div className="space-y-2">
              {STEP_ORDER.map((key) => {
                const step = steps.find((s) => s.key === key)!
                return (
                  <div key={key} className="flex items-center justify-between text-sm">
                    <span>{step.label}</span>
                    <div className="flex items-center gap-2">
                      {step.detail && <span className="text-muted-foreground text-xs">{step.detail}</span>}
                      <Badge
                        variant={
                          step.status === "done" ? "default" : step.status === "error" ? "destructive" : "outline"
                        }
                      >
                        {step.status === "pending" && "Pendente"}
                        {step.status === "running" && "Executando..."}
                        {step.status === "done" && "Concluído"}
                        {step.status === "error" && "Erro"}
                      </Badge>
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>

          {downloadResult && downloadResult.base64 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => downloadBase64(downloadResult.base64, downloadResult.fileName)}
            >
              <Download className="h-4 w-4 mr-2" /> Baixar novamente ({downloadResult.fileName})
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
