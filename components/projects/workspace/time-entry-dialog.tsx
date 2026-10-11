"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Info, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { createTimeEntry, updateTimeEntry } from "@/actions/project-time-entries"
import { toDateInputValue } from "@/utils/format"
import type { TaskOptions, TeamMember } from "@/components/projects/workspace/types"

export type EditableTimeEntry = { id: string; taskId: string; userId: string; date: Date | string; minutes: number; note: string | null }

interface TimeEntryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectCode: string
  tasks: TaskOptions["tasks"]
  team: TeamMember[]
  currentUserId: string
  /** projects:update — may log hours for other team members. */
  canManage: boolean
  /** The project consumes a client contract — reminds not to also launch a demand. */
  consumesContract: boolean
  today: string
  defaultTaskId?: string
  entry?: EditableTimeEntry | null
  onSaved?: () => void
}

export function TimeEntryDialog(props: TimeEntryDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{props.entry ? "Editar apontamento" : "Apontar horas"}</DialogTitle>
        </DialogHeader>
        {/* Mounted per opening, so the fields start from the entry/defaults each time. */}
        {props.open && <TimeEntryForm key={props.entry?.id ?? props.defaultTaskId ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function TimeEntryForm({
  onOpenChange,
  projectId,
  projectCode,
  tasks,
  team,
  currentUserId,
  canManage,
  consumesContract,
  today,
  defaultTaskId,
  entry,
  onSaved,
}: TimeEntryDialogProps) {
  const [taskId, setTaskId] = useState(entry?.taskId ?? defaultTaskId ?? "")
  const [userId, setUserId] = useState(entry?.userId ?? currentUserId)
  const [date, setDate] = useState(entry ? toDateInputValue(entry.date) : today)
  const [hours, setHours] = useState(entry ? String(Math.round((entry.minutes / 60) * 100) / 100) : "")
  const [note, setNote] = useState(entry?.note ?? "")
  const [loading, setLoading] = useState(false)

  const minutes = Math.round(Number(hours.replace(",", ".")) * 60)

  async function submit() {
    if (!taskId) return toast.error("Selecione a tarefa")
    if (!minutes || minutes <= 0) return toast.error("Informe a duração em horas")
    setLoading(true)
    const payload = { taskId, userId, date, minutes, note }
    const result = entry ? await updateTimeEntry(projectId, entry.id, payload) : await createTimeEntry(projectId, payload)
    setLoading(false)
    if (result.success) {
      toast.success(entry ? "Apontamento atualizado" : "Horas apontadas")
      onOpenChange(false)
      onSaved?.()
    } else toast.error(result.error || "Erro ao salvar")
  }

  return (
    <>
        <DialogBody>
          <Field>
            <FieldLabel>Tarefa</FieldLabel>
            <Combobox
              items={tasks.map((t) => ({ value: t.id, label: `${projectCode}-${t.number} ${t.title}` }))}
              value={taskId}
              onValueChange={setTaskId}
              placeholder="Selecione a tarefa"
            />
          </Field>
          {canManage && (
            <Field>
              <FieldLabel>Profissional</FieldLabel>
              <Combobox items={team.map((m) => ({ value: m.id, label: m.name }))} value={userId} onValueChange={(v) => setUserId(v || currentUserId)} />
            </Field>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Data</FieldLabel>
              <DatePicker value={date} onValueChange={(v) => setDate(v || today)} />
            </Field>
            <Field>
              <FieldLabel htmlFor="te-hours">Duração (horas)</FieldLabel>
              <Input id="te-hours" inputMode="decimal" placeholder="Ex.: 1,5" value={hours} onChange={(e) => setHours(e.target.value)} />
              {minutes > 0 && (
                <FieldDescription>
                  {Math.floor(minutes / 60)}h{String(minutes % 60).padStart(2, "0")}
                </FieldDescription>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="te-note">O que foi feito (opcional)</FieldLabel>
            <Textarea id="te-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {consumesContract && (
            <p className="flex items-start gap-1.5 rounded-md bg-muted p-2 text-xs text-muted-foreground">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Estas horas já consomem o contrato do cliente — não lance o mesmo trabalho também como demanda.
            </p>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
          <Button onClick={submit} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
    </>
  )
}
