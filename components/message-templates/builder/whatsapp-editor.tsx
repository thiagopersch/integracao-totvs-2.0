"use client"

import { useMemo, useRef, useState } from "react"
import { Bold, Code, Italic, Strikethrough } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { interpolate } from "@/lib/message-templates/interpolate"
import { exampleVariables, type VariableGroup } from "@/lib/message-templates/variable-catalog"
import { whatsappToHtml } from "@/lib/message-templates/whatsapp"
import { VariablePicker } from "../variable-picker"
import { insertAtCursor } from "../variable-input"
import { WhatsAppBubble } from "./preview-dialog"

const MAX_LENGTH = 4096

const FORMATS = [
  { marker: "*", title: "Negrito (*texto*)", icon: Bold },
  { marker: "_", title: "Itálico (_texto_)", icon: Italic },
  { marker: "~", title: "Tachado (~texto~)", icon: Strikethrough },
  { marker: "```", title: "Monoespaçado (```texto```)", icon: Code },
] as const

/** WhatsApp template editor: plain text with WhatsApp markup + live chat-bubble preview. */
export function WhatsAppEditor({
  value,
  onChange,
  variableGroups,
  invalid,
}: {
  value: string
  onChange: (value: string) => void
  variableGroups: VariableGroup[]
  invalid?: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [withExamples, setWithExamples] = useState(true)
  const examples = useMemo(() => exampleVariables(), [])

  function wrapSelection(marker: string) {
    const el = ref.current
    if (!el) return
    const { selectionStart: start, selectionEnd: end } = el
    const selected = value.slice(start, end) || "texto"
    const next = `${value.slice(0, start)}${marker}${selected}${marker}${value.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + marker.length, start + marker.length + selected.length)
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="space-y-2">
        <Label htmlFor="whatsapp-body">Mensagem</Label>
        <div className={cn("overflow-hidden rounded-md border", invalid && "border-destructive")}>
          <div className="flex items-center gap-0.5 border-b bg-muted/40 p-1">
            {FORMATS.map(({ marker, title, icon: Icon }) => (
              <button
                key={marker}
                type="button"
                title={title}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => wrapSelection(marker)}
                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
            <span className="ml-auto" />
            <VariablePicker
              groups={variableGroups}
              onSelect={(key) => insertAtCursor(ref.current, value, `{{${key}}}`, onChange)}
            />
          </div>
          <Textarea
            ref={ref}
            id="whatsapp-body"
            value={value}
            maxLength={MAX_LENGTH}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Olá, {{recipientName}}! ..."
            className="min-h-[360px] resize-y rounded-none border-0 font-mono text-sm shadow-none focus-visible:ring-0"
          />
        </div>
        <p className="flex justify-between text-xs text-muted-foreground">
          <span>Use *negrito*, _itálico_, ~tachado~ e ```monoespaçado```. O envio por WhatsApp será integrado em uma próxima etapa.</span>
          <span className="shrink-0 tabular-nums">
            {value.length}/{MAX_LENGTH}
          </span>
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Pré-visualização</Label>
          <div className="flex items-center gap-2">
            <Switch id="wa-examples" checked={withExamples} onCheckedChange={setWithExamples} />
            <Label htmlFor="wa-examples" className="text-xs text-muted-foreground">
              Dados de exemplo
            </Label>
          </div>
        </div>
        <WhatsAppBubble html={whatsappToHtml(withExamples ? interpolate(value, examples, { escape: false }) : value)} />
      </div>
    </div>
  )
}
