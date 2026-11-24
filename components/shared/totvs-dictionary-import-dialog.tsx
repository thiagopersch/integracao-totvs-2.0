"use client"

import { useRef, useState } from "react"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import { AlertTriangle, FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/lib/toast"
import { DICTIONARY_IMPORT_BATCH } from "@/schemas/totvs-dictionary.schema"

type ImportMode = "merge" | "replace"
type ImportSummary = { mode: ImportMode; read: number; skipped: number; inserted: number; updated: number; removed: number; total: number }
type ImportResult = ({ success: true } & ImportSummary) | { success: false; error: string }
type ImportPhase = "reading" | "sending" | "finishing"

const MAX_FILE_SIZE = 50 * 1024 * 1024
const PHASE_LABEL: Record<ImportPhase, string> = { reading: "Lendo arquivo…", sending: "Enviando registros…", finishing: "Finalizando…" }

interface TotvsDictionaryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canReplace: boolean
  onImported: () => void
}

class StepError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
  }
}

/** POSTs one step of the import; retries once on network or 5xx errors (batches are idempotent upserts). */
async function postStep<T>(body: unknown, retries = 1): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch("/api/totvs-dictionary/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {
        throw new StepError("Falha de conexão com o servidor", true)
      })
      const data = (await response.json().catch(() => null)) as (T & { error?: string }) | null
      if (response.ok && data) return data
      throw new StepError(data?.error ?? `Falha na importação (HTTP ${response.status})`, response.status >= 500)
    } catch (error) {
      if (!(error instanceof StepError) || !error.retryable || attempt >= retries) throw error
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}

/** Reads a .csv/.xlsx in the spreadsheet layout (TABELA | COLUNA | DESCRICAO) in the browser and sends
 *  it in small JSON batches — no request-size limit, real progress per batch. */
export function TotvsDictionaryImportDialog({ open, onOpenChange, canReplace, onImported }: TotvsDictionaryImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [running, setRunning] = useState(false)
  const [phase, setPhase] = useState<ImportPhase | null>(null)
  const [progress, setProgress] = useState<{ done: number; total: number; batch: number; batches: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setFile(null)
    setMode("merge")
    setConfirmReplace(false)
    setPhase(null)
    setProgress(null)
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setRunning(true)
    setResult(null)
    setProgress(null)
    try {
      if (file.size > MAX_FILE_SIZE) throw new Error("Arquivo excede o limite de 50 MB")
      setPhase("reading")
      // Lazy: the xlsx parser is only downloaded when an import actually runs.
      const { parseDictionaryFile } = await import("@/lib/totvs-dictionary")
      const parsed = parseDictionaryFile(new Uint8Array(await file.arrayBuffer()))
      if (parsed.rows.length === 0) throw new Error("Nenhuma linha válida — o arquivo precisa das colunas TABELA, COLUNA e DESCRICAO")

      setPhase("sending")
      const { startedAt } = await postStep<{ startedAt: string }>({ step: "start", mode, fileName: file.name, total: parsed.rows.length })
      const batches = Math.ceil(parsed.rows.length / DICTIONARY_IMPORT_BATCH)
      let inserted = 0
      let updated = 0
      setProgress({ done: 0, total: parsed.rows.length, batch: 0, batches })
      for (let b = 0; b < batches; b++) {
        const rows = parsed.rows.slice(b * DICTIONARY_IMPORT_BATCH, (b + 1) * DICTIONARY_IMPORT_BATCH)
        const r = await postStep<{ inserted: number; updated: number }>({ step: "batch", rows })
        inserted += r.inserted
        updated += r.updated
        setProgress({ done: Math.min((b + 1) * DICTIONARY_IMPORT_BATCH, parsed.rows.length), total: parsed.rows.length, batch: b + 1, batches })
      }

      setPhase("finishing")
      const fin = await postStep<{ removed: number; total: number }>({
        step: "finish",
        mode,
        startedAt,
        fileName: file.name,
        read: parsed.read,
        skipped: parsed.skipped,
        inserted,
        updated,
      })
      setResult({ success: true, mode, read: parsed.read, skipped: parsed.skipped, inserted, updated, removed: fin.removed, total: fin.total })
      toast.success("Dicionário importado")
      onImported()
    } catch (error) {
      const message = (error as Error).message
      setResult({ success: false, error: mode === "replace" ? `${message}. Nenhum registro anterior foi removido.` : message })
      toast.error(message)
    } finally {
      setRunning(false)
      setPhase(null)
    }
  }

  const blocked = !file || running || (mode === "replace" && !confirmReplace)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (running) return
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Importar dicionário de dados</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Envie um arquivo <b>.csv</b> ou <b>.xlsx</b> no mesmo formato da planilha: colunas <code>TABELA</code>, <code>COLUNA</code> e <code>DESCRICAO</code>. A
              linha com <code>COLUNA = #</code> é a descrição da própria tabela.
            </p>

            <div className="flex flex-wrap items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                hidden
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setResult(null)
                  e.target.value = ""
                }}
              />
              <Button type="button" variant="outline" size="sm" disabled={running} onClick={() => fileRef.current?.click()}>
                <FileUp className="h-4 w-4 mr-2" /> {file ? "Trocar arquivo" : "Selecionar arquivo"}
              </Button>
              <span className="text-muted-foreground">{file ? `${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)` : "Nenhum arquivo selecionado"}</span>
            </div>

            <ToggleButtonGroup
              exclusive
              size="small"
              color="primary"
              value={mode}
              disabled={running}
              onChange={(_e, v: ImportMode | null) => {
                if (!v) return
                setMode(v)
                setConfirmReplace(false)
              }}
              aria-label="Modo de importação"
              sx={{ flexWrap: "wrap", "& .MuiToggleButton-root": { textTransform: "none", px: 2 } }}
            >
              <ToggleButton value="merge">Mesclar (adiciona e atualiza)</ToggleButton>
              {canReplace && <ToggleButton value="replace">Substituir tudo</ToggleButton>}
            </ToggleButtonGroup>

            {mode === "replace" && (
              <label className="flex items-start gap-2 rounded-md border border-amber-500/50 bg-amber-500/10 p-3 cursor-pointer">
                <input type="checkbox" className="mt-0.5" checked={confirmReplace} disabled={running} onChange={(e) => setConfirmReplace(e.target.checked)} />
                <span className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                  Entendo que todos os registros atuais do dicionário serão apagados e trocados pelo conteúdo do arquivo (inclusive os editados manualmente).
                </span>
              </label>
            )}

            {running && phase && (
              <div className="space-y-1">
                {progress ? (
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                ) : (
                  <Progress />
                )}
                <p className="text-xs text-muted-foreground">
                  {PHASE_LABEL[phase]}
                  {progress &&
                    ` ${progress.done.toLocaleString("pt-BR")} de ${progress.total.toLocaleString("pt-BR")} linhas · lote ${progress.batch}/${progress.batches} · ${Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%`}
                </p>
              </div>
            )}

            {result?.success && (
              <div className="rounded-md border p-3 space-y-1">
                <p className="font-medium">Importação concluída</p>
                <p className="text-muted-foreground">
                  {result.inserted.toLocaleString("pt-BR")} novos · {result.updated.toLocaleString("pt-BR")} atualizados
                  {result.skipped ? ` · ${result.skipped.toLocaleString("pt-BR")} linhas ignoradas (sem tabela/coluna)` : ""}
                  {result.mode === "replace" ? ` · ${result.removed.toLocaleString("pt-BR")} registros anteriores substituídos` : ""}
                </p>
                <p className="text-muted-foreground">Total no dicionário: {result.total.toLocaleString("pt-BR")}</p>
              </div>
            )}
            {result && !result.success && <p className="text-destructive">{result.error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={running} onClick={() => (reset(), onOpenChange(false))}>
            {result?.success ? "Fechar" : "Cancelar"}
          </Button>
          <Button type="button" variant={mode === "replace" ? "destructive" : "default"} disabled={blocked} onClick={() => void handleImport()}>
            {running && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === "replace" ? "Substituir dicionário" : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
