"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Copy, Download, FileText, Loader2 } from "lucide-react"
import { fetchRubeusLogDetail } from "@/actions/integrations/rubeus-logs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import type { PsCredentials } from "@/lib/ps-docs/credential"
import { downloadBlob } from "@/lib/ps-docs/download-utils"
import { dash, formatDurationSeconds, formatLogDate, formatPayload, isDownloadUrl, isErrorLog, logTypeLabel } from "@/lib/rubeus-logs/format"
import type { RubeusLogDetail, RubeusLogRow } from "@/lib/rubeus-logs/types"
import { toast } from "@/lib/toast"

interface LogDetailDialogProps {
  /** Row clicked in the table — `null` closes the dialog. */
  row: RubeusLogRow | null
  credentials: PsCredentials | null
  onOpenChange: (open: boolean) => void
}

type DetailState = { status: "loading" } | { status: "error"; error: string } | { status: "done"; log: RubeusLogDetail }

function InfoItem({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 break-words text-sm">{value}</div>
    </div>
  )
}

async function downloadLogFile(url: string, fileName: string) {
  const res = await fetch("/api/rubeus-logs/file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, fileName }),
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `Falha no download (HTTP ${res.status})`)
  }
  downloadBlob(await res.blob(), fileName)
}

function PayloadSection({ value, label, fileLabel, fileName }: { value: string | null; label: string; fileLabel: string; fileName: string }) {
  const [downloading, setDownloading] = useState(false)
  const isFile = isDownloadUrl(value)
  const payload = isFile ? null : formatPayload(value)

  async function handleDownload() {
    if (!value) return
    setDownloading(true)
    try {
      await downloadLogFile(value.trim(), fileName)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setDownloading(false)
    }
  }

  async function handleCopy() {
    if (!payload) return
    try {
      await navigator.clipboard.writeText(payload.kind === "empty" ? "" : payload.text)
      toast.success(`${label} copiados`)
    } catch {
      toast.error("Não foi possível copiar para a área de transferência")
    }
  }

  return (
    <AccordionItem value={label} className="rounded-md border bg-card shadow-md">
      <AccordionTrigger className="px-4 text-base font-semibold">{label}</AccordionTrigger>
      <AccordionContent className="px-4 pb-2">
        {isFile ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <FileText className="size-8 text-muted-foreground" />
              <span>{fileLabel}</span>
            </div>
            <Button variant="outline" onClick={handleDownload} disabled={downloading}>
              {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />} Baixar arquivo
            </Button>
          </div>
        ) : payload?.kind === "empty" ? (
          <p className="text-muted-foreground">{payload.text}</p>
        ) : (
          <div className="space-y-2">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleCopy}>
                <Copy className="size-4" /> Copiar
              </Button>
            </div>
            <pre className="max-h-96 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">{payload?.text}</pre>
          </div>
        )}
      </AccordionContent>
    </AccordionItem>
  )
}

/** "Log {id}" dialog: identification, log data and the sent/returned payloads (formatted or as a .txt download). */
export function LogDetailDialog({ row, credentials, onOpenChange }: LogDetailDialogProps) {
  // Result tagged with the log it belongs to: a different (or no) id means the clicked log is still loading.
  const [fetched, setFetched] = useState<{ id: number; state: DetailState } | null>(null)

  useEffect(() => {
    if (!row?.categories_id || !credentials) return
    let cancelled = false
    const id = row.id
    fetchRubeusLogDetail({ credentials, categoriesId: row.categories_id, id })
      .then((res) => !cancelled && setFetched({ id, state: res.success ? { status: "done", log: res.log } : { status: "error", error: res.error } }))
      .catch((e: Error) => !cancelled && setFetched({ id, state: { status: "error", error: e.message } }))
    return () => {
      cancelled = true
    }
  }, [row, credentials])

  const state: DetailState = !row
    ? { status: "loading" }
    : !row.categories_id
      ? { status: "error", error: "Este log não informa a categoria — não é possível abrir os detalhes." }
      : fetched?.id === row.id
        ? fetched.state
        : { status: "loading" }
  const log = state.status === "done" ? state.log : null

  return (
    <Dialog open={!!row} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            Log {row?.id}
            {row && <Badge variant={isErrorLog(row.log_type_id) ? "destructive" : "secondary"}>{logTypeLabel(row.log_type_id)}</Badge>}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="pb-6">
          {state.status === "loading" && (
            <div className="space-y-4">
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          )}

          {state.status === "error" && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          {log && row && (
            <Accordion multiple defaultValue={["identificacao", "dados", "Dados enviados", "Dados retornados"]} className="space-y-4">
              <AccordionItem value="identificacao" className="rounded-md border bg-card shadow-md">
                <AccordionTrigger className="px-4 text-base font-semibold">Identificação</AccordionTrigger>
                <AccordionContent className="grid grid-cols-1 gap-4 px-4 pb-2 sm:grid-cols-3">
                  <InfoItem label="Candidato" value={dash(log.person_name ?? row.person_name)} />
                  <InfoItem label="Categoria" value={dash(log.categories_title ?? row.categories_title)} />
                  <InfoItem label="Portal" value={dash(log.portal_title ?? row.portal_title)} />
                  <InfoItem label="PS" value={dash(log.selective_process_title ?? row.selective_process_title)} className="sm:col-span-3" />
                  <InfoItem label="Etapa" value={dash(log.stage_title)} />
                  <InfoItem label="Passo" value={dash(log.step_title)} />
                  <InfoItem label="Localização" value={dash(log.log_location_title)} />
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="dados" className="rounded-md border bg-card shadow-md">
                <AccordionTrigger className="px-4 text-base font-semibold">Dados do log</AccordionTrigger>
                <AccordionContent className="space-y-4 px-4 pb-2">
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <InfoItem label="ID" value={log.id} />
                    <InfoItem label="Criado em" value={formatLogDate(log.created_at)} />
                    <InfoItem label="Descrição" value={dash(log.description)} />
                    <InfoItem label="Duração" value={formatDurationSeconds(log.duration)} />
                  </div>
                  <div className="grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-4">
                    <InfoItem label="Tipo" value={logTypeLabel(row.log_type_id)} />
                    <InfoItem label="Última alteração" value={log.updated_at && log.updated_at !== log.created_at ? formatLogDate(log.updated_at) : "-"} />
                    <InfoItem label="Usuário" value={dash(log.user_name)} />
                    <InfoItem label="Observação" value={dash(log.observation)} />
                  </div>
                </AccordionContent>
              </AccordionItem>

              <div className="pt-2 text-sm font-medium text-muted-foreground">Detalhes</div>
              <PayloadSection value={log.sent} label="Dados enviados" fileLabel="Detalhes do envio" fileName={`log-${log.id}-enviado.txt`} />
              <PayloadSection value={log.result} label="Dados retornados" fileLabel="Detalhes do retorno" fileName={`log-${log.id}-retornado.txt`} />
            </Accordion>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
