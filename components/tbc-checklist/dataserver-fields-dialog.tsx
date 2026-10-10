"use client"

import { useMemo, useState } from "react"
import { Loader2, Maximize2, Minimize2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { DataserverFieldPicker } from "@/components/tbc-checklist/dataserver-field-picker"
import { PermissionDeniedAlert } from "@/components/tbc-checklist/permission-denied-alert"
import { useDataserverSchema } from "@/components/tbc-checklist/use-dataserver-schema"
import { isRelatedDataserver, type ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"
import { fieldKey, toSelection, type ChecklistSelection } from "@/lib/tbc-checklist-selection"
import { cn } from "@/lib/utils"
import type { TbcChecklistField } from "@/schemas/tbc-checklist.schema"
import type { SchemaTable } from "@/utils/soap-schema"
import type { Dataserver } from "@/generated/prisma/client"

/** "add": pick a Data Server not in the checklist yet. "edit": change the fields of one already in it. */
export type DataserverFieldsDialogMode = { kind: "add" } | { kind: "edit"; code: string; fields: TbcChecklistField[] }

interface DataserverFieldsDialogProps {
  tbcId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: DataserverFieldsDialogMode
  dataservers: Dataserver[]
  /** Data Servers already in the checklist — not offered again in "add" mode. */
  usedCodes: string[]
  /** Contexto saved with the checklist — GetSchema needs it; still editable here. */
  initialContext: ChecklistContextForm
  saving: boolean
  /** TBC user the SOAP calls run as — named in the "sem permissão" message. */
  tbcUser?: string
  /** `context` is the Contexto the fields were fetched with — saved on a checklist that has none yet. */
  onConfirm: (dataserverCode: string, fields: TbcChecklistField[], context: ChecklistContextForm) => void
}

/**
 * Lists every field the Data Server's GetSchema returns (all tables) so the user picks the ones the
 * checklist validates. In "edit" mode the saved fields come pre-checked, so new ones can be added
 * (or old ones dropped) at any time.
 */
export function DataserverFieldsDialog({
  tbcId,
  open,
  onOpenChange,
  mode,
  dataservers,
  usedCodes,
  initialContext,
  saving,
  tbcUser,
  onConfirm,
}: DataserverFieldsDialogProps) {
  const [dataserverId, setDataserverId] = useState("")
  const [contextForm, setContextForm] = useState<ChecklistContextForm>(initialContext)
  const [tables, setTables] = useState<SchemaTable[] | null>(null)
  const [selection, setSelection] = useState<ChecklistSelection>(() => (mode.kind === "edit" ? toSelection(mode.fields) : new Set()))
  const [maximized, setMaximized] = useState(false)

  const options = dataservers.filter((d) => isRelatedDataserver(d.code) && !usedCodes.includes(d.code))
  const editCode = mode.kind === "edit" ? mode.code : ""
  const editDataserver = useMemo(
    () => (editCode ? (dataservers.find((d) => d.code === editCode) ?? { code: editCode, name: editCode }) : undefined),
    [dataservers, editCode]
  )
  const selected = mode.kind === "edit" ? editDataserver : options.find((d) => d.id === dataserverId)

  const schema = useDataserverSchema(tbcId, selected, contextForm, setTables)

  function handleSelectDataserver(id: string) {
    setDataserverId(id)
    setTables(null)
    setSelection(new Set())
  }

  /** Selected fields with the casing GetSchema uses, in schema order. Primary keys are left out:
   *  the picker always shows them checked, but they only identify the record — never a card. */
  const selectedFields: TbcChecklistField[] = (tables ?? []).flatMap((table) =>
    table.fields
      .filter((f) => !f.isPrimaryKey && selection.has(fieldKey(table.name, f.name)))
      .map((f) => ({ table: table.name, name: f.name }))
  )

  const canConfirm = !!selected && !!tables && selectedFields.length > 0 && !schema.loading && !saving

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent
        className={cn("transition-[width,height]", maximized && "h-[99vh]! max-h-[99vh]! w-[99vw]! max-w-[99vw]!")}
        headerActions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMaximized((v) => !v)}
            title={maximized ? "Tamanho normal" : "Maximizar"}
          >
            {maximized ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        }
      >
        <DialogHeader>
          <DialogTitle>{mode.kind === "edit" ? `Campos do checklist — ${selected?.name ?? editCode}` : "Adicionar Data Server ao checklist"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col">
          {mode.kind === "add" && (
            <Field>
              <FieldLabel>Data Server</FieldLabel>
              <Combobox
                items={options.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` }))}
                value={dataserverId}
                onValueChange={handleSelectDataserver}
                placeholder="Selecione um Data Server"
                searchPlaceholder="Buscar Data Server..."
                emptyText="Nenhum Data Server disponível."
              />
            </Field>
          )}

          <ChecklistContextFields value={contextForm} onChange={setContextForm} />

          <div className="flex items-center justify-between gap-2">
            <FieldLabel>Campos do Data Server</FieldLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs"
              onClick={() => void schema.refetch()}
              disabled={!selected || !schema.contextComplete || schema.loading}
              title="Buscar campos novamente no TOTVS"
            >
              <RefreshCw className={schema.loading ? "h-3 w-3 animate-spin" : "h-3 w-3"} />
              Buscar campos
            </Button>
          </div>

          {!selected || !schema.contextComplete ? (
            <p className="text-xs text-muted-foreground">
              Selecione o Data Server e preencha coligada, filial e tipo de curso para buscar os campos no TOTVS.
            </p>
          ) : schema.loading ? (
            <div className="flex h-24 items-center justify-center rounded-md border text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Buscando campos no TOTVS...
            </div>
          ) : schema.permissionDenied ? (
            <PermissionDeniedAlert tbcUser={tbcUser} dataservers={[{ code: selected.code, name: selected.name }]} />
          ) : tables ? (
            <DataserverFieldPicker dataserverCode={selected.code} tables={tables} value={selection} onChange={setSelection} />
          ) : null}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={() => selected && onConfirm(selected.code, selectedFields, contextForm)} disabled={!canConfirm}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar campos ({selectedFields.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
