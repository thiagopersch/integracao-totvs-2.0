"use client"

import DOMPurify from "dompurify"
import { useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { renderLogicTrailHtml } from "@/lib/ps-docs/logic-trail-html"
import { DEFAULT_STYLE, type LogicTrailDoc, type StyleConfig } from "@/lib/ps-docs/types"

interface LogicTrailPreviewProps {
  model: LogicTrailDoc
  style: StyleConfig
}

export function LogicTrailPreview({ model, style = DEFAULT_STYLE }: LogicTrailPreviewProps) {
  const html = useMemo(() => renderLogicTrailHtml(model, style), [model, style])

  return (
    <Card className={style.followAppTheme ? undefined : "doc-preview-light"}>
      <CardContent className="pt-6">
        <div className="max-w-none" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />
      </CardContent>
    </Card>
  )
}
