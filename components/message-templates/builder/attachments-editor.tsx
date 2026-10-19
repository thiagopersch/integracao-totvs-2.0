"use client"

import { FileSpreadsheet, Paperclip, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  defaultAttachmentFileName,
  TEMPLATE_ATTACHMENT_DESCRIPTIONS,
  TEMPLATE_ATTACHMENT_LABELS,
  type TemplateAttachment,
  type TemplateAttachmentType,
} from "@/lib/message-templates/attachments"
import type { MessageTemplateScope } from "@/lib/message-templates/events"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"
import { VariableInput } from "../variable-input"

interface AttachmentsEditorProps {
  value: TemplateAttachment[]
  onChange: (value: TemplateAttachment[]) => void
  variableGroups: VariableGroup[]
  /** Attachments the event/scope can generate (allowedAttachmentTypes) — the sends that fill them. */
  allowedTypes: TemplateAttachmentType[]
  scope: MessageTemplateScope
  error?: string
}

/** "Anexos" section of an EMAIL template: files generated at send time and attached to the email. */
export function AttachmentsEditor({ value, onChange, variableGroups, allowedTypes, scope, error }: AttachmentsEditorProps) {
  const addable = allowedTypes.filter((type) => !value.some((a) => a.type === type))

  function update(index: number, patch: Partial<TemplateAttachment>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  return (
    <div className="max-w-3xl space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">Anexos</Label>
        {addable.map((type) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onChange([...value, { type, fileName: defaultAttachmentFileName(type, scope) }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> {TEMPLATE_ATTACHMENT_LABELS[type]}
          </Button>
        ))}
      </div>

      {allowedTypes.length === 0 && value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Anexos gerados automaticamente estão disponíveis para o relatório de demandas do período e para o consumo de horas com
          escopo &quot;Todos os clientes&quot;.
        </p>
      )}
      {allowedTypes.length > 0 && value.length === 0 && (
        <p className="text-xs text-muted-foreground">Nenhum anexo. Adicione a planilha para enviá-la junto com o e-mail.</p>
      )}

      {value.map((attachment, index) => (
        <div key={`${attachment.type}-${index}`} className="space-y-1.5 rounded-md border p-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            {TEMPLATE_ATTACHMENT_LABELS[attachment.type]}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="ml-auto"
              aria-label="Remover anexo"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{TEMPLATE_ATTACHMENT_DESCRIPTIONS[attachment.type]}</p>
          <Label htmlFor={`attachment-${index}`} className="text-xs">
            Nome do arquivo
          </Label>
          <VariableInput
            id={`attachment-${index}`}
            value={attachment.fileName}
            onChange={(fileName) => update(index, { fileName })}
            groups={variableGroups}
            placeholder={defaultAttachmentFileName(attachment.type, scope)}
            aria-invalid={!!error}
          />
          {!allowedTypes.includes(attachment.type) && (
            <p className="text-xs text-destructive">Este anexo não é gerado para o evento/escopo selecionado — remova-o.</p>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
