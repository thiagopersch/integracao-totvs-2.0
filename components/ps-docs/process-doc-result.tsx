"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { PsDocPreview } from "@/components/ps-docs/ps-doc-preview"
import { Download, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"
import { documentToMarkdown } from "@/lib/ps-docs/export-markdown"
import { renderDocumentHtml } from "@/lib/ps-docs/render-html"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import type { DocumentacaoPS, StyleConfig } from "@/lib/ps-docs/types"

interface ProcessDocResultProps {
  model: DocumentacaoPS
  warnings: string[]
  style: StyleConfig
}

/** The badge/download-buttons/warnings+preview block used to show one generated
 *  processo seletivo documentation — shared between the "processo específico" mode and each
 *  process's tab in the "portal inteiro" mode, so both stay in sync (same exports, same preview). */
export function ProcessDocResult({ model, warnings, style }: ProcessDocResultProps) {
  const hasResult = model.etapas.length > 0

  async function handleDownloadDocx() {
    // The docx library is only downloaded when the user actually exports.
    const { buildDocx } = await import("@/lib/ps-docs/export-docx")
    const blob = await buildDocx(model, style)
    downloadBlob(blob, `mapeamento-ps-${slugify(model.tituloPortal)}.docx`)
  }

  function handleDownloadMarkdown() {
    const markdown = documentToMarkdown(model, style)
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), `mapeamento-ps-${slugify(model.tituloPortal)}.md`)
  }

  async function handleCopyForGoogleDocs() {
    const html = renderDocumentHtml(model, style)
    const markdown = documentToMarkdown(model, style)
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

      <PsDocPreview model={model} style={style} />
    </div>
  )
}
