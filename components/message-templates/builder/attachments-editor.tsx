"use client"

import { FileSpreadsheet, Paperclip, Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  DEFAULT_DEMANDS_XLSX_FILE_NAME,
  TEMPLATE_ATTACHMENT_DESCRIPTIONS,
  TEMPLATE_ATTACHMENT_LABELS,
  type TemplateAttachment,
} from "@/lib/message-templates/attachments"
import type { VariableGroup } from "@/lib/message-templates/variable-catalog"
import { VariableInput } from "../variable-input"

interface AttachmentsEditorProps {
  value: TemplateAttachment[]
  onChange: (value: TemplateAttachment[]) => void
  variableGroups: VariableGroup[]
  /** Only the demands report fills the client + period the spreadsheet needs. */
  supportsDemandsXlsx: boolean
  error?: string
}

/** "Anexos" section of an EMAIL template: files generated at send time and attached to the email. */
export function AttachmentsEditor({ value, onChange, variableGroups, supportsDemandsXlsx, error }: AttachmentsEditorProps) {
  const hasXlsx = value.some((a) => a.type === "DEMANDS_XLSX")

  function update(index: number, patch: Partial<TemplateAttachment>) {
    onChange(value.map((a, i) => (i === index ? { ...a, ...patch } : a)))
  }

  return (
    <div className="max-w-3xl space-y-2 rounded-lg border bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Paperclip className="h-4 w-4 text-muted-foreground" />
        <Label className="text-sm">Anexos</Label>
        {supportsDemandsXlsx && !hasXlsx && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => onChange([...value, { type: "DEMANDS_XLSX", fileName: DEFAULT_DEMANDS_XLSX_FILE_NAME }])}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Planilha de demandas (XLSX)
          </Button>
        )}
      </div>

      {!supportsDemandsXlsx && value.length === 0 && (
        <p className="text-xs text-muted-foreground">
          Anexos gerados automaticamente estão disponíveis para o evento &quot;Relatório de demandas do período&quot;.
        </p>
      )}
      {supportsDemandsXlsx && value.length === 0 && (
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
            placeholder={DEFAULT_DEMANDS_XLSX_FILE_NAME}
            aria-invalid={!!error}
          />
          {!supportsDemandsXlsx && (
            <p className="text-xs text-destructive">Este anexo só é gerado no evento &quot;Relatório de demandas do período&quot;.</p>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
