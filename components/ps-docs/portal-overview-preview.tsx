"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Download, ClipboardCopy } from "lucide-react"
import { toast } from "sonner"
import { renderPortalOverviewHtml } from "@/lib/ps-docs/render-html"
import { portalOverviewToMarkdown } from "@/lib/ps-docs/export-markdown"
import { buildPortalOverviewDocx } from "@/lib/ps-docs/export-docx"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import type { PortalOverviewSpec, StyleConfig } from "@/lib/ps-docs/types"

interface PortalOverviewPreviewProps {
  overview: PortalOverviewSpec
  style: StyleConfig
}

/** Preview + export (docx/md/Google Docs) of the portal-level "Geral/Consultas/Scripts/
 *  Integrações/Segurança/Domínio/TOTVS" section — a separate document from any single processo
 *  seletivo's own documentation (rendered per-tab by `ProcessDocResult`). */
export function PortalOverviewPreview({ overview, style }: PortalOverviewPreviewProps) {
  const html = useMemo(() => renderPortalOverviewHtml(overview, style), [overview, style])

  async function handleDownloadDocx() {
    const blob = await buildPortalOverviewDocx(overview, style)
    downloadBlob(blob, `portal-${slugify(overview.geral.nome)}.docx`)
  }

  function handleDownloadMarkdown() {
    const markdown = portalOverviewToMarkdown(overview)
    downloadBlob(new Blob([markdown], { type: "text/markdown" }), `portal-${slugify(overview.geral.nome)}.md`)
  }

  async function handleCopyForGoogleDocs() {
    const markdown = portalOverviewToMarkdown(overview)
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
        <div className="flex-1" />
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadDocx}>
          <Download className="h-4 w-4 mr-2" /> Baixar .docx
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleDownloadMarkdown}>
          <Download className="h-4 w-4 mr-2" /> Baixar .md
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={handleCopyForGoogleDocs}>
          <ClipboardCopy className="h-4 w-4 mr-2" /> Copiar para Google Docs
        </Button>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
        </CardContent>
      </Card>
    </div>
  )
}
