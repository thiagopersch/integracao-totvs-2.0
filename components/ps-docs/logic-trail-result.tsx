"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LogicTrailPreview } from "@/components/ps-docs/logic-trail-preview"
import { Download, ClipboardCopy } from "lucide-react"
import { toast } from "@/lib/toast"
import { logicTrailToMarkdown } from "@/lib/ps-docs/logic-trail-markdown"
import { renderLogicTrailHtml } from "@/lib/ps-docs/logic-trail-html"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import { DEFAULT_STYLE, type LogicTrailDoc, type StyleConfig } from "@/lib/ps-docs/types"

interface LogicTrailResultProps {
  model: LogicTrailDoc
  warnings: string[]
  style: StyleConfig
}

/** The badge/download-buttons/warnings+preview block for the "Trilhas de lógica" documentation —
 *  same role as `ProcessDocResult`, but for the logic-only trail view: início (breadcrumb) →
 *  meio (regras+condição, ou a fonte de dados) → fim (elemento). */
export function LogicTrailResult({ model, warnings, style = DEFAULT_STYLE }: LogicTrailResultProps) {
  const hasResult = model.trilhas.length > 0

  async function handleDownloadDocx() {
    const { buildLogicTrailDocx } = await import("@/lib/ps-docs/logic-trail-docx")
    const blob = await buildLogicTrailDocx(model, style)
    downloadBlob(blob, `trilhas-logica-${slugify(model.tituloPortal)}.docx`)
  }

  function handleDownloadMarkdown() {
    const markdown = logicTrailToMarkdown(model, style)
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), `trilhas-logica-${slugify(model.tituloPortal)}.md`)
  }

  async function handleCopyForGoogleDocs() {
    const html = renderLogicTrailHtml(model, style)
    const markdown = logicTrailToMarkdown(model, style)
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
        <Badge variant="outline">{model.trilhas.length} trilha(s)</Badge>
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

      <LogicTrailPreview model={model} style={style} />
    </div>
  )
}
