"use client"

import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { renderDocumentHtml } from "@/lib/ps-docs/render-html"
import type { DocumentacaoPS, StyleConfig } from "@/lib/ps-docs/types"

interface PsDocPreviewProps {
  model: DocumentacaoPS
  style: StyleConfig
}

export function PsDocPreview({ model, style }: PsDocPreviewProps) {
  const html = useMemo(() => renderDocumentHtml(model, style), [model, style])

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="max-w-none" dangerouslySetInnerHTML={{ __html: html }} />
      </CardContent>
    </Card>
  )
}
