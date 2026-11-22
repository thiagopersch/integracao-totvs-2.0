"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PsDocPreview } from "@/components/ps-docs/ps-doc-preview"
import { Download, ClipboardCopy, FileCode } from "lucide-react"
import { toast } from "@/lib/toast"
import { docDocx, docMarkdown, docPreviewHtml, docStandaloneHtml } from "@/lib/ps-docs/doc-exports"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS, type StyleConfig } from "@/lib/ps-docs/types"

interface ProcessDocResultProps {
  model: DocumentacaoPS
  warnings: string[]
  style: StyleConfig
  /** "Conteúdo da documentação" answers — applied to the preview and every export. */
  options?: DocOptions
}

/** The badge/download-buttons/warnings+preview block used to show one generated
 *  processo seletivo documentation — shared between the "processo específico" mode and each
 *  process's tab in the "portal inteiro" mode, so both stay in sync (same exports, same preview). */
export function ProcessDocResult({ model, warnings, style, options = DEFAULT_DOC_OPTIONS }: ProcessDocResultProps) {
  const hasResult = model.etapas.length > 0

  const fileBase = `mapeamento-ps-${slugify(model.tituloPortal)}`

  async function handleDownloadDocx() {
    const blob = await docDocx([model], style, options)
    downloadBlob(blob, `${fileBase}.docx`)
  }

  function handleDownloadMarkdown() {
    const markdown = docMarkdown(model, style, options)
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), `${fileBase}.md`)
  }

  function handleDownloadHtml() {
    const html = docStandaloneHtml([model], style, options)
    downloadBlob(new Blob([html], { type: "text/html" }), `${fileBase}.html`)
  }

  async function handleCopyForGoogleDocs() {
    const html = docPreviewHtml(model, style, options)
    const markdown = docMarkdown(model, style, options)
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

  return (
    <div className="space-y-4">
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
            <Button type="button" variant="outline" size="sm" onClick={handleDownloadHtml}>
              <FileCode className="h-4 w-4 mr-2" /> Baixar .html
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

      <PsDocPreview model={model} style={style} options={options} />
    </div>
  )
}
