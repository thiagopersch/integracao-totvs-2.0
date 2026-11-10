"use client"

import DOMPurify from "dompurify"
import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { renderDocumentHtml } from "@/lib/ps-docs/render-html"
import { DEFAULT_DOC_OPTIONS, type DocOptions, type DocumentacaoPS, type StyleConfig } from "@/lib/ps-docs/types"

interface PsDocPreviewProps {
  model: DocumentacaoPS
  style: StyleConfig
  options?: DocOptions
}

export function PsDocPreview({ model, style, options = DEFAULT_DOC_OPTIONS }: PsDocPreviewProps) {
  const html = useMemo(() => renderDocumentHtml(model, style, options), [model, style, options])

  return (
    <Card className={style.followAppTheme ? undefined : "doc-preview-light"}>
      <CardContent className="pt-6">
        <div className="max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </CardContent>
    </Card>
  )
}
