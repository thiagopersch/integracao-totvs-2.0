"use client"

import { CircleCheck, CircleX, Download } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import { formatFieldValue } from "@/lib/tbc-checklist-field-rules"

interface ChecklistFieldCardProps {
  field: ChecklistFieldRow
}

/** Values longer than this aren't rendered inline — offered as a download instead. */
const MAX_INLINE_VALUE_LENGTH = 255

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

/** Raw text as a .txt; base64Binary columns (e.g. ARQUIVOEDITAL) decoded back to their bytes. */
function downloadValue(field: ChecklistFieldRow) {
  if (field.type === "base64Binary") {
    const binary = atob(field.valor.replace(/\s/g, ""))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    downloadBlob(new Blob([bytes], { type: "application/octet-stream" }), `${field.name}.bin`)
    return
  }
  downloadBlob(new Blob([field.valor], { type: "text/plain;charset=utf-8" }), `${field.name}.txt`)
}

function FieldValue({ field }: { field: ChecklistFieldRow }) {
  const value = field.valor.trim()
  if (!value) {
    return <p className="mt-1 rounded-md border bg-background/60 p-2 text-sm">Sem valor configurado</p>
  }
  if (field.type === "base64Binary" || value.length > MAX_INLINE_VALUE_LENGTH) {
    return (
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-background/60 p-2 text-sm">
        <span className="text-muted-foreground">
          {field.type === "base64Binary" ? "Arquivo binário" : `Conteúdo extenso (${value.length} caracteres)`}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={() => downloadValue(field)}>
          <Download className="mr-2 h-3.5 w-3.5" />
          Baixar conteúdo
        </Button>
      </div>
    )
  }
  return <p className="mt-1 rounded-md border bg-background/60 p-2 text-sm break-words">{formatFieldValue(field)}</p>
}

export function ChecklistFieldCard({ field }: ChecklistFieldCardProps) {
  return (
    <Accordion
      defaultValue={[]}
      className={cn(
        // Flex item of CardsGrid: at least 1/3 of the row (max 3 per row; 1/2 and full width on
        // narrower screens), sized to its caption, growing to fill whatever the row leaves free.
        "max-w-full min-w-full grow basis-auto rounded-md border sm:min-w-[calc((100%-0.75rem)/2)] lg:min-w-[calc((100%-1.5rem)/3)]",
        field.configurado
          ? "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30"
          : "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
      )}
    >
      <AccordionItem value="field" className="border-none">
        <AccordionTrigger className="min-w-0 items-center px-3 py-3 hover:no-underline [&[data-open]>svg]:rotate-180">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
            <span
              className={cn(
                "min-w-0 text-sm font-medium break-words",
                field.configurado ? "text-green-900 dark:text-green-100" : "text-red-900 dark:text-red-100"
              )}
            >
              {field.caption}
            </span>
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                field.configurado ? "text-green-800 dark:text-green-200" : "text-red-800 dark:text-red-200"
              )}
            >
              {field.configurado ? <CircleCheck className="h-3.5 w-3.5" /> : <CircleX className="h-3.5 w-3.5" />}
              {field.configurado ? "Configurado" : "Não configurado"}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-3 pb-3">
          <p className="text-xs text-muted-foreground">Valor no TOTVS</p>
          <FieldValue field={field} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
