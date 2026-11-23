"use client"

import DOMPurify from "dompurify"
import { useMemo } from "react"
import { ClipboardCopy, Download, FileCode } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import type { StyleConfig } from "@/lib/ps-docs/types"
import { sqlDocToMarkdown } from "@/lib/sql-docs/export-sql-doc-markdown"
import { renderSqlDocFragment, renderSqlDocStandaloneHtml } from "@/lib/sql-docs/render-sql-doc-html"
import type { SqlDocOptions, SqlDocument } from "@/lib/sql-docs/types"
import { toast } from "@/lib/toast"

interface SqlDocResultProps {
  doc: SqlDocument
  style: StyleConfig
  options: SqlDocOptions
}

/** Export buttons + preview of the "Mapeamento de consultas" document (same set as the RB-33 result). */
export function SqlDocResult({ doc, style, options }: SqlDocResultProps) {
  const previewHtml = useMemo(() => renderSqlDocFragment(doc, style, options), [doc, style, options])
  const fileBase = `mapeamento-consultas-${slugify(doc.title) || "sql"}`

  async function handleDownloadDocx() {
    const { buildSqlDocDocx } = await import("@/lib/sql-docs/export-sql-doc-docx")
    downloadBlob(await buildSqlDocDocx(doc, style, options), `${fileBase}.docx`)
  }

  function handleDownloadMarkdown() {
    downloadBlob(new Blob([sqlDocToMarkdown(doc, options)], { type: "text/markdown" }), `${fileBase}.md`)
  }

  function handleDownloadHtml() {
    downloadBlob(new Blob([renderSqlDocStandaloneHtml(doc, style, options)], { type: "text/html" }), `${fileBase}.html`)
  }

  async function handleCopyForGoogleDocs() {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([previewHtml], { type: "text/html" }),
          "text/plain": new Blob([sqlDocToMarkdown(doc, options)], { type: "text/plain" }),
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
        <Badge variant="outline">{doc.entries.length} consulta(s)</Badge>
        <div className="flex-1" />
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
      </div>

      <Card className={style.followAppTheme ? undefined : "doc-preview-light"}>
        <CardContent className="pt-6">
          <div className="max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewHtml) }} />
        </CardContent>
      </Card>
    </div>
  )
}
