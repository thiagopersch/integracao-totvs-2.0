"use client"

import { CircleCheck, CircleX } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"
import { formatChecklistValue } from "@/lib/tbc-checklist-values"

interface ChecklistFieldCardProps {
  field: ChecklistFieldRow
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
          <p className="mt-1 rounded-md border bg-background/60 p-2 text-sm break-words">
            {field.valor.trim() ? formatChecklistValue(field.valor) : "Sem valor configurado"}
          </p>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
