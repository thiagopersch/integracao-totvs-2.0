"use client"

import { useState } from "react"
import { Import, Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel } from "@/components/ui/field"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ImportChecklistDialog } from "@/components/tbc-checklist/import-checklist-dialog"
import { createTbcChecklist, deleteTbcChecklist, renameTbcChecklist } from "@/actions/integrations/tbc-checklist-templates"
import type { TbcChecklistImportSource, TbcChecklistView } from "@/services/tbc-checklist.service"

interface ChecklistSelectorProps {
  tbcId: string
  checklists: TbcChecklistView[]
  activeId: string | null
  onSelect: (id: string) => void
  /** A checklist was created or renamed — `checklist` is its saved state. */
  onSaved: (checklist: TbcChecklistView) => void
  onDeleted: (id: string) => void
  /** Another checklist's structure was imported into the active one — `checklist` is its new state. */
  onImported: (checklist: TbcChecklistView, source: TbcChecklistImportSource) => void
  /** Bumped by the parent to open the "Novo checklist" dialog from elsewhere (empty state). */
  createRequest: number
}

type NameDialog = { kind: "create" } | { kind: "rename"; checklist: TbcChecklistView }

export function ChecklistSelector({
  tbcId,
  checklists,
  activeId,
  onSelect,
  onSaved,
  onDeleted,
  onImported,
  createRequest,
}: ChecklistSelectorProps) {
  const [nameDialog, setNameDialog] = useState<NameDialog | null>(null)
  const [name, setName] = useState("")
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [handledCreateRequest, setHandledCreateRequest] = useState(createRequest)

  const active = checklists.find((c) => c.id === activeId) ?? null

  function openCreate() {
    setName("")
    setNameDialog({ kind: "create" })
  }

  // Parent asked for the create dialog (render-time state sync, no effect needed).
  if (createRequest !== handledCreateRequest) {
    setHandledCreateRequest(createRequest)
    openCreate()
  }

  async function handleSaveName() {
    if (!nameDialog) return
    setSaving(true)
    const result =
      nameDialog.kind === "create" ? await createTbcChecklist(tbcId, name) : await renameTbcChecklist(nameDialog.checklist.id, name)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success(nameDialog.kind === "create" ? "Checklist criado" : "Checklist renomeado")
    setNameDialog(null)
    onSaved(result.data)
  }

  async function handleDelete() {
    if (!active) return
    setDeleting(true)
    const result = await deleteTbcChecklist(active.id)
    setDeleting(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success("Checklist excluído")
    setConfirmDelete(false)
    onDeleted(active.id)
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Field className="w-full sm:w-80">
        <FieldLabel>Checklist</FieldLabel>
        <Combobox
          items={checklists.map((c) => ({ value: c.id, label: c.name }))}
          value={activeId ?? ""}
          onValueChange={onSelect}
          placeholder={checklists.length ? "Selecione um checklist" : "Nenhum checklist criado"}
          searchPlaceholder="Buscar checklist..."
          emptyText="Nenhum checklist encontrado."
          disabled={!checklists.length}
        />
      </Field>
      <Button type="button" variant="outline" onClick={openCreate}>
        <Plus className="mr-2 h-4 w-4" />
        Novo
      </Button>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button type="button" variant="outline" disabled={!active} onClick={() => setImportOpen(true)}>
              <Import className="mr-2 h-4 w-4" />
              Importar
            </Button>
          }
        />
        <TooltipContent>Importar a estrutura de outro checklist para este</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Renomear checklist"
              disabled={!active}
              onClick={() => {
                if (!active) return
                setName(active.name)
                setNameDialog({ kind: "rename", checklist: active })
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>Renomear checklist</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="destructive"
              size="icon"
              aria-label="Excluir checklist"
              disabled={!active}
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
        <TooltipContent>Excluir checklist</TooltipContent>
      </Tooltip>

      <Dialog open={nameDialog !== null} onOpenChange={(open) => !open && !saving && setNameDialog(null)}>
        <DialogContent className="h-auto max-h-[85vh] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{nameDialog?.kind === "rename" ? "Renomear checklist" : "Novo checklist"}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <form
              id="tbc-checklist-name-form"
              onSubmit={(e) => {
                e.preventDefault()
                void handleSaveName()
              }}
            >
              <Field>
                <FieldLabel>Nome</FieldLabel>
                <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Processo seletivo — graduação" />
              </Field>
            </form>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setNameDialog(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button type="submit" form="tbc-checklist-name-form" disabled={saving || name.trim().length < 2}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {importOpen && active && (
        <ImportChecklistDialog
          target={active}
          onOpenChange={setImportOpen}
          onImported={(checklist, source) => {
            setImportOpen(false)
            onImported(checklist, source)
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir checklist"
        description={`O checklist "${active?.name ?? ""}" e os campos escolhidos nele serão excluídos. Os dados no TOTVS não são alterados.`}
        confirmLabel="Excluir"
        variant="destructive"
        loading={deleting}
        loadingLabel="Excluindo..."
        onConfirm={() => void handleDelete()}
      />
    </div>
  )
}
