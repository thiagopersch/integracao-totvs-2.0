"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { DEFAULT_LOG_EXPORT_KEYS, LOG_EXPORT_FIELDS, type LogExportField, type LogExportFieldKey } from "@/lib/rubeus-logs/format"

export type LogExportTarget = "csv" | "xlsx" | "pdf" | "sheets"

const TITLES: Record<LogExportTarget, string> = {
  csv: "Exportar CSV",
  xlsx: "Baixar Excel",
  pdf: "Exportar PDF",
  sheets: "Copiar p/ Google Sheets",
}

const TABLE_FIELDS = LOG_EXPORT_FIELDS.filter((f) => f.group === "table")
const DETAIL_FIELDS = LOG_EXPORT_FIELDS.filter((f) => f.group === "detail")

interface LogExportDialogProps {
  /** `null` closes the dialog. */
  target: LogExportTarget | null
  rowCount: number
  /** Details being loaded before the export: `{ done, total }`. */
  progress: { done: number; total: number } | null
  onConfirm: (keys: LogExportFieldKey[]) => void
  /** Closes the dialog; while loading it also cancels the detail fetch. */
  onCancel: () => void
}

function FieldGroup({
  title,
  fields,
  selected,
  disabled,
  onToggle,
  onSetAll,
  note,
}: {
  title: string
  fields: LogExportField[]
  selected: Set<LogExportFieldKey>
  disabled: boolean
  onToggle: (key: LogExportFieldKey, checked: boolean) => void
  onSetAll: (keys: LogExportFieldKey[], checked: boolean) => void
  note?: string
}) {
  const keys = fields.map((f) => f.key)
  const count = keys.filter((k) => selected.has(k)).length
  return (
    <section className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">
          {title} <span className="font-normal text-muted-foreground">({count}/{keys.length})</span>
        </h3>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" disabled={disabled || count === keys.length} onClick={() => onSetAll(keys, true)}>
            Marcar todos
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={disabled || count === 0} onClick={() => onSetAll(keys, false)}>
            Limpar
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-1 rounded-md border p-3 sm:grid-cols-3">
        {fields.map((f) => (
          <label key={f.key} className="flex cursor-pointer items-center gap-1 text-sm">
            <Checkbox checked={selected.has(f.key)} disabled={disabled} onCheckedChange={(c) => onToggle(f.key, c)} />
            {f.label}
          </label>
        ))}
      </div>
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </section>
  )
}

/** Asks which fields go into the export; table fields come checked, detail-only fields unchecked.
 *  Mount it with a fresh `key` per opening so the selection starts from the default. */
export function LogExportDialog({ target, rowCount, progress, onConfirm, onCancel }: LogExportDialogProps) {
  const [selected, setSelected] = useState<Set<LogExportFieldKey>>(() => new Set(DEFAULT_LOG_EXPORT_KEYS))
  const busy = !!progress

  const toggle = (key: LogExportFieldKey, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (checked) next.add(key)
      else next.delete(key)
      return next
    })
  const setAll = (keys: LogExportFieldKey[], checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev)
      for (const k of keys) {
        if (checked) next.add(k)
        else next.delete(k)
      }
      return next
    })

  const confirm = () => onConfirm(LOG_EXPORT_FIELDS.filter((f) => selected.has(f.key)).map((f) => f.key))

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{target ? TITLES[target] : ""}</DialogTitle>
          <DialogDescription>Escolha os campos a exportar dos {rowCount} log(s) listados.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-5">
          <FieldGroup title="Campos da tabela" fields={TABLE_FIELDS} selected={selected} disabled={busy} onToggle={toggle} onSetAll={setAll} />
          <FieldGroup
            title="Demais informações (detalhe do log)"
            fields={DETAIL_FIELDS}
            selected={selected}
            disabled={busy}
            onToggle={toggle}
            onSetAll={setAll}
            note="Esses campos são lidos log a log no portal antes de exportar. Os links de envio/retorno são temporários (expiram em cerca de 2 horas); quando o portal devolve os dados sem link, o conteúdo é exportado."
          />
          {progress && (
            <Progress value={progress.total ? (progress.done / progress.total) * 100 : null}>
              <span className="text-sm text-muted-foreground">
                Carregando detalhes {progress.done}/{progress.total}…
              </span>
            </Progress>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button onClick={confirm} disabled={busy || selected.size === 0}>
            {busy && <Loader2 className="size-4 animate-spin" />} Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
