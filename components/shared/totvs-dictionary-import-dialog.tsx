"use client"

import { useRef, useState } from "react"
import ToggleButton from "@mui/material/ToggleButton"
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup"
import { AlertTriangle, FileUp, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { toast } from "@/lib/toast"

type ImportMode = "merge" | "replace"
type ImportResult =
  | { success: true; mode: ImportMode; read: number; skipped: number; inserted: number; updated: number; removed: number; total: number }
  | { success: false; error: string }

interface TotvsDictionaryImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  canReplace: boolean
  onImported: () => void
}

/** Uploads a .csv/.xlsx in the spreadsheet layout (TABELA | COLUNA | DESCRICAO) to the streaming
 *  import route, showing batch progress and the final summary. */
export function TotvsDictionaryImportDialog({ open, onOpenChange, canReplace, onImported }: TotvsDictionaryImportDialogProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [mode, setMode] = useState<ImportMode>("merge")
  const [confirmReplace, setConfirmReplace] = useState(false)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  function reset() {
    setFile(null)
    setMode("merge")
    setConfirmReplace(false)
    setProgress(null)
    setResult(null)
  }

  async function handleImport() {
    if (!file) return
    setRunning(true)
    setResult(null)
    setProgress(null)
    try {
      const body = new FormData()
      body.append("file", file)
      body.append("mode", mode)
      const response = await fetch("/api/totvs-dictionary/import", { method: "POST", body })
      if (!response.body) throw new Error(`Falha na importação (HTTP ${response.status})`)
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let final: ImportResult | null = null
      for (;;) {
        const { value, done } = await reader.read()
        if (value) buffer += decoder.decode(value, { stream: !done })
        const lines = buffer.split("\n")
        buffer = done ? "" : (lines.pop() ?? "")
        for (const line of lines.filter((l) => l.trim())) {
          const event = JSON.parse(line) as { type: string; done?: number; total?: number; result?: ImportResult }
          if (event.type === "progress") setProgress({ done: event.done ?? 0, total: event.total ?? 0 })
          if (event.type === "done" && event.result) final = event.result
        }
        if (done) break
      }
      const res = final ?? { success: false as const, error: "A importação foi interrompida" }
      setResult(res)
      if (res.success) {
        toast.success("Dicionário importado")
        onImported()
      } else toast.error(res.error)
    } catch (error) {
      setResult({ success: false, error: (error as Error).message })
    } finally {
      setRunning(false)
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

            {(running || progress) && progress && (
              <div className="space-y-1">
                <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                <p className="text-xs text-muted-foreground">
                  {progress.done.toLocaleString("pt-BR")} de {progress.total.toLocaleString("pt-BR")} linhas
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
