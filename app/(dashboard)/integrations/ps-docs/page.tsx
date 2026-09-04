"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PasswordInput } from "@/components/ui/password-input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { StylePanel } from "@/components/ps-docs/style-panel"
import { PsDocPreview } from "@/components/ps-docs/ps-doc-preview"
import { FileText, Loader2, Download, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"
import { listSelectiveProcessStages, fetchStageDocumentation } from "@/actions/integrations/ps-docs"
import { documentToMarkdown } from "@/lib/ps-docs/export-markdown"
import { renderDocumentHtml } from "@/lib/ps-docs/render-html"
import { buildDocx } from "@/lib/ps-docs/export-docx"
import { DEFAULT_STYLE, type DocumentacaoPS, type StyleConfig } from "@/lib/ps-docs/types"

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

function slugify(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function PsDocsPage() {
  const [tokenPs, setTokenPs] = useState("")
  const [idPs, setIdPs] = useState("")
  const [crmDomain, setCrmDomain] = useState("")
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [model, setModel] = useState<DocumentacaoPS | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [style, setStyle] = useState<StyleConfig>(DEFAULT_STYLE)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tokenPs.trim() || !idPs.trim()) {
      toast.error("Informe o Token PS e o ID PS")
      return
    }

    setLoading(true)
    setError(null)
    setWarnings([])
    setModel(null)
    setProgress(null)

    try {
      const listRes = await listSelectiveProcessStages({ tokenPs, idPs, crmDomain: crmDomain.trim() || undefined })
      if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
        setError(listRes.error || "Erro ao consultar o processo seletivo")
        toast.error(listRes.error || "Erro ao consultar o processo seletivo")
        return
      }

      // Etapas aparecem uma a uma conforme chegam, em vez de esperar o processo inteiro.
      setModel({ tituloPortal: listRes.tituloPortal ?? `Processo Seletivo ${idPs}`, idPs: listRes.idPs ?? idPs, etapas: [] })
      setProgress({ done: 0, total: listRes.stages.length })

      const allWarnings: string[] = [...(listRes.catalogWarnings ?? [])]
      for (const stage of listRes.stages) {
        const stageRes = await fetchStageDocumentation({
          tokenPs,
          idPs,
          stage: stage.ref,
          fieldCatalogEntries: listRes.fieldCatalogEntries,
          actionCatalogEntries: listRes.actionCatalogEntries,
        })
        if (stageRes.success && stageRes.etapa) {
          setModel((prev) => (prev ? { ...prev, etapas: [...prev.etapas, stageRes.etapa!] } : prev))
          if (stageRes.warnings) allWarnings.push(...stageRes.warnings)
        } else {
          allWarnings.push(`Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar"}`)
        }
        setProgress((prev) => (prev ? { ...prev, done: prev.done + 1 } : prev))
      }

      setWarnings(allWarnings)
      toast.success("Documentação gerada com sucesso")
      if (allWarnings.length > 0) toast.warning(`${allWarnings.length} aviso(s) durante a leitura da estrutura — confira o resultado.`)
    } finally {
      setLoading(false)
    }
  }

  async function handleDownloadDocx() {
    if (!model) return
    const blob = await buildDocx(model, style)
    downloadBlob(blob, `mapeamento-ps-${slugify(model.tituloPortal)}.docx`)
  }

  function handleDownloadMarkdown() {
    if (!model) return
    const markdown = documentToMarkdown(model)
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), `mapeamento-ps-${slugify(model.tituloPortal)}.md`)
  }

  async function handleCopyForGoogleDocs() {
    if (!model) return
    const html = renderDocumentHtml(model, style)
    const markdown = documentToMarkdown(model)
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([markdown], { type: "text/plain" }),
        }),
      ])
      toast.success("Copiado — cole diretamente no Google Docs")
    } catch {
      toast.error("Não foi possível copiar para a área de transferência")
    }
  }

  const hasResult = model !== null && model.etapas.length > 0

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-5 w-5" /> Documentação PS
        </h1>
        <p className="text-sm text-muted-foreground">
          Lê a estrutura completa de um processo seletivo (etapas, passos, campos, componentes, ações TOTVS/Rubeus e
          feedbacks) a partir do Token PS e do ID PS, e gera a documentação técnica no padrão do mapeamento de ficha.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="tokenPs">Token PS</FieldLabel>
                <PasswordInput id="tokenPs" value={tokenPs} onChange={setTokenPs} placeholder="Copiado do localStorage do portal admin" />
              </Field>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="idPs">ID PS</FieldLabel>
                  <Input id="idPs" value={idPs} onChange={(e) => setIdPs(e.target.value)} placeholder="Ex: 5537" />
                </Field>
                <Field>
                  <FieldLabel htmlFor="crmDomain">Link do CRM (opcional)</FieldLabel>
                  <Input id="crmDomain" value={crmDomain} onChange={(e) => setCrmDomain(e.target.value)} placeholder="Ex: https://crmtoledo.apprubeus.com.br/" />
                </Field>
              </div>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Gerar documentação
              </Button>
              {loading && progress && (
                <div className="w-full max-w-xs space-y-1">
                  <Progress value={(progress.done / Math.max(progress.total, 1)) * 100} />
                  <p className="text-xs text-muted-foreground text-center">
                    {progress.done}/{progress.total} etapa(s) processada(s)
                  </p>
                </div>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {model && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{model.etapas.length} etapa(s)</Badge>
            {warnings.length > 0 && <Badge variant="secondary">{warnings.length} aviso(s)</Badge>}
            <div className="flex-1" />
            {hasResult && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadDocx}>
                  <Download className="h-4 w-4 mr-2" /> Baixar .docx
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDownloadMarkdown}>
                  <Download className="h-4 w-4 mr-2" /> Baixar .md
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCopyForGoogleDocs}>
                  <ClipboardCopy className="h-4 w-4 mr-2" /> Copiar para Google Docs
                </Button>
              </>
            )}
          </div>

          {warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Avisos da leitura</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
                  {warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
            <StylePanel style={style} onChange={setStyle} />
            <PsDocPreview model={model} style={style} />
          </div>
        </>
      )}

      {error && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Erro</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
