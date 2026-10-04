"use client"

import { CircleCheck, CircleX } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { cn } from "@/lib/utils"
import { isConfiguredValue } from "@/lib/tbc-checklist-values"
import type { ChecklistRecord, ChecklistTableResult } from "@/actions/integrations/tbc-checklist"

/** The visibility/required flags of each portal field (SPSParamsCampos), in screen order. */
const FLAG_FIELDS = [
  "VISIVELCANDIDATO",
  "VISIVELRESPONSAVEL",
  "OBRIGATORIOCANDIDATO",
  "OBRIGATORIORESPONSAVEL",
  "VISIVELCANDIDATOMATRIC",
  "VISIVELRESPONSAVELMATRIC",
  "OBRIGATORIOCANDIDATOMATRIC",
  "OBRIGATORIORESPONSAVELMATRIC",
]

type Tone = "all" | "some" | "none"

const TONE_CLASSES: Record<Tone, { card: string; text: string }> = {
  all: {
    card: "border-green-300 bg-green-50 dark:border-green-800 dark:bg-green-950/30",
    text: "text-green-900 dark:text-green-100",
  },
  some: {
    card: "border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950/30",
    text: "text-yellow-900 dark:text-yellow-100",
  },
  none: {
    card: "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30",
    text: "text-red-900 dark:text-red-100",
  },
}

type PortalField = {
  key: string
  group: string
  name: string
  flags: { name: string; caption: string; configured: boolean }[]
}

function value(record: ChecklistRecord, name: string): string {
  return record.fields.find((f) => f.name.toUpperCase() === name)?.valor.trim() ?? ""
}

function toPortalField(record: ChecklistRecord): PortalField {
  return {
    key: record.key,
    group: value(record, "DSCGRUPOCAMPO") || value(record, "GRUPOCAMPO") || "Sem grupo",
    name: value(record, "DSCNOMECAMPO") || value(record, "NOMECAMPO") || record.label,
    flags: FLAG_FIELDS.flatMap((name) => {
      const field = record.fields.find((f) => f.name.toUpperCase() === name)
      return field ? [{ name, caption: field.caption, configured: isConfiguredValue(field.valor) }] : []
    }),
  }
}

function toneOf(field: PortalField): Tone {
  const configured = field.flags.filter((f) => f.configured).length
  if (configured === 0) return "none"
  return configured === field.flags.length ? "all" : "some"
}

/**
 * "Visibilidade/obrigatoriedade de campos": one collapsible card per portal field, grouped (and
 * sorted) alphabetically by group, 4 per row. The card is green when every visibility/required
 * flag is set, yellow when only some are, red when none; opening it shows just those 8 flags.
 */
export function FieldVisibilityMatrix({ result }: { result: ChecklistTableResult }) {
  if (result.empty) {
    return <p className="pt-3 text-sm text-muted-foreground">Nenhum registro no TOTVS.</p>
  }

  const byGroup = new Map<string, PortalField[]>()
  for (const field of result.records.map(toPortalField)) {
    byGroup.set(field.group, [...(byGroup.get(field.group) ?? []), field])
  }
  const groups = [...byGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "pt-BR"))
    .map(([group, fields]) => ({ group, fields: fields.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")) }))

  return (
    <div className="flex flex-col gap-4 pt-3">
      {groups.map(({ group, fields }) => (
        <div key={group} className="flex flex-col gap-2">
          <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</h5>
          <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {fields.map((field) => (
              <PortalFieldCard key={field.key} field={field} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function PortalFieldCard({ field }: { field: PortalField }) {
  const tone = TONE_CLASSES[toneOf(field)]
  const configuredCount = field.flags.filter((f) => f.configured).length

  return (
    <Accordion defaultValue={[]} className={cn("min-w-0 rounded-md border", tone.card)}>
      <AccordionItem value="field" className="border-none">
        <AccordionTrigger className="min-w-0 items-center px-3 py-3 hover:no-underline">
          <div className="flex min-w-0 flex-1 flex-col gap-1 text-left">
            <span className={cn("min-w-0 text-sm font-medium break-words", tone.text)}>{field.name}</span>
            <span className={cn("text-xs", tone.text)}>
              {configuredCount} de {field.flags.length} configurados
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="grid grid-cols-1 gap-2 px-3 pb-3">
          {field.flags.map((flag) => (
            <div
              key={flag.name}
              className={cn(
                "flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs",
                flag.configured ? TONE_CLASSES.all.card : TONE_CLASSES.none.card,
                flag.configured ? TONE_CLASSES.all.text : TONE_CLASSES.none.text
              )}
            >
              {flag.configured ? <CircleCheck className="h-3.5 w-3.5 shrink-0" /> : <CircleX className="h-3.5 w-3.5 shrink-0" />}
              <span className="min-w-0 break-words">{flag.caption}</span>
            </div>
          ))}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
