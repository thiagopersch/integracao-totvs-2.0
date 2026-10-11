"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  CalendarClock,
  Clock,
  Diamond,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Trash2,
  UserRound,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, ScrollableTabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { PendingRegion } from "@/components/shared/pending-region"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { PriorityBadge, ProgressCell, TaskStatusBadge } from "@/components/projects/project-badges"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import {
  addChecklistItem,
  addTaskComment,
  addTaskDependency,
  deleteChecklistItem,
  deleteProjectTask,
  deleteTaskComment,
  moveProjectTask,
  quickCreateProjectTask,
  removeTaskDependency,
  updateChecklistItem,
} from "@/actions/project-tasks"
import { deleteTimeEntry } from "@/actions/project-time-entries"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, formatHours, taskKey, type TaskStatus } from "@/lib/projects"
import { isEmptyCustomFieldValue, type CustomFieldDef } from "@/lib/custom-fields"
import { formatDateOnly, formatRelativeTime } from "@/utils/format"
import type { EditableTimeEntry } from "@/components/projects/workspace/time-entry-dialog"
import type { TaskDetail, TaskOptions } from "@/components/projects/workspace/types"

interface TaskSheetProps {
  open: boolean
  /** A different task is being loaded (URL changed) — dims the content. */
  pending: boolean
  task: TaskDetail | null
  projectId: string
  projectCode: string
  options: TaskOptions
  defs: CustomFieldDef[]
  usersById: Record<string, string>
  currentUserId: string
  can: { update: boolean; delete: boolean; logTime: boolean; manageHours: boolean; moderate: boolean }
  onClose: () => void
  onOpenTask: (taskId: string) => void
  onEdit: () => void
  onLogTime: (entry?: EditableTimeEntry) => void
  refresh: () => void
}

function DetailRow({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

export function TaskSheet({
  open,
  pending,
  task,
  projectId,
  projectCode,
  options,
  defs,
  usersById,
  currentUserId,
  can,
  onClose,
  onOpenTask,
  onEdit,
  onLogTime,
  refresh,
}: TaskSheetProps) {
  const [tab, setTab] = useState("detalhes")
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newChecklist, setNewChecklist] = useState("")
  const [newSubtask, setNewSubtask] = useState("")
  const [newComment, setNewComment] = useState("")
  const [newPredecessor, setNewPredecessor] = useState("")

  async function run(action: () => Promise<{ success: boolean; error?: string; warning?: string }>, success?: string) {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (result.success) {
      if (success) toast.success(success)
      if (result.warning) toast.warning(result.warning)
      refresh()
      return true
    }
    toast.error(result.error || "Erro ao salvar")
    return false
  }

  const loggedMinutes = task?.timeEntries.reduce((s, e) => s + e.minutes, 0) ?? 0
  const checklistDone = task?.checklistItems.filter((i) => i.done).length ?? 0
  const predecessorIds = new Set(task?.predecessors.map((p) => p.predecessorId))
  const predecessorOptions = options.tasks
    .filter((t) => task && t.id !== task.id && !predecessorIds.has(t.id))
    .map((t) => ({ value: t.id, label: `${taskKey(projectCode, t.number)} ${t.title}` }))

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-2xl data-[side=right]:sm:max-w-2xl">
        {!task ? (
          <div className="space-y-3 p-6">
            <SheetTitle className="sr-only">Carregando tarefa</SheetTitle>
            {pending ? (
              <>
                <Skeleton className="h-6 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-40 w-full" />
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Tarefa não encontrada ou excluída.</p>
            )}
          </div>
        ) : (
          <PendingRegion pending={pending || busy} className="min-h-0 flex-1">
            <div className="flex h-full flex-col">
            <SheetHeader className="border-b pr-12">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{taskKey(projectCode, task.number)}</span>
                {task.parent && (
                  <button type="button" className="truncate hover:underline" onClick={() => onOpenTask(task.parent!.id)}>
                    ↳ {taskKey(projectCode, task.parent.number)} {task.parent.title}
                  </button>
                )}
              </div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                {task.isMilestone && <Diamond className="h-4 w-4 shrink-0 fill-amber-500 text-amber-500" />}
                {task.title}
              </SheetTitle>
              <SheetDescription className="sr-only">Detalhes da tarefa</SheetDescription>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {can.update ? (
                  <div className="w-44">
                    <OptionSelect
                      options={toOptions(TASK_STATUS_LABELS, TASK_STATUS_COLORS)}
                      value={task.status}
                      onChange={(status) =>
                        status && status !== task.status && run(() => moveProjectTask(projectId, task.id, { status: status as TaskStatus }), "Status atualizado")
                      }
                    />
                  </div>
                ) : (
                  <TaskStatusBadge status={task.status} />
                )}
                <PriorityBadge priority={task.priority} />
                <div className="ml-auto flex gap-1">
                  {can.logTime && (
                    <Button size="sm" variant="outline" onClick={() => onLogTime()}>
                      <Clock className="mr-1.5 h-4 w-4" /> Apontar horas
                    </Button>
                  )}
                  {can.update && (
                    <Button size="sm" variant="outline" onClick={onEdit}>
                      <Pencil className="mr-1.5 h-4 w-4" /> Editar
                    </Button>
                  )}
                  {can.delete && (
                    <WithTooltip label="Excluir tarefa">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </WithTooltip>
                  )}
                </div>
              </div>
            </SheetHeader>

            <Tabs value={tab} onValueChange={(v) => setTab(v as string)} className="flex min-h-0 flex-1 flex-col">
              <ScrollableTabsList className="mx-4 mt-3 w-auto">
                <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                <TabsTrigger value="subtarefas">Subtarefas ({task.children.length})</TabsTrigger>
                <TabsTrigger value="dependencias">Dependências ({task.predecessors.length + task.successors.length})</TabsTrigger>
                <TabsTrigger value="checklist">
                  Checklist ({checklistDone}/{task.checklistItems.length})
                </TabsTrigger>
                <TabsTrigger value="comentarios">Comentários ({task.comments.length})</TabsTrigger>
                <TabsTrigger value="horas">Horas</TabsTrigger>
              </ScrollableTabsList>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <TabsContent value="detalhes" className="space-y-4">
                  <div className="space-y-2.5">
                    <DetailRow icon={UserRound} label="Responsável">
                      {task.assignee?.name ?? <span className="text-muted-foreground">Sem responsável</span>}
                    </DetailRow>
                    <DetailRow icon={CalendarClock} label="Início → Prazo">
                      {task.startDate ? formatDateOnly(task.startDate) : "—"} → {task.dueDate ? formatDateOnly(task.dueDate) : "—"}
                    </DetailRow>
                    <DetailRow icon={Clock} label="Horas">
                      {formatHours(task.loggedMinutes, "minutes")}
                      {task.estimateHours ? <span className="text-muted-foreground"> de {formatHours(task.estimateHours)} estimadas</span> : null}
                    </DetailRow>
                    <DetailRow icon={Send} label="Progresso">
                      <ProgressCell value={task.progress} />
                    </DetailRow>
                    {task.tags.length > 0 && (
                      <DetailRow icon={Link2} label="Tags">
                        <div className="flex flex-wrap gap-1">
                          {task.tags.map((t) => (
                            <ColorBadge key={t.id} label={t.name} color={t.color} />
                          ))}
                        </div>
                      </DetailRow>
                    )}
                    {task.completedAt && (
                      <DetailRow icon={CalendarClock} label="Concluída em">
                        {formatDateOnly(task.completedAt)}
                      </DetailRow>
                    )}
                  </div>
                  {defs.some((d) => !isEmptyCustomFieldValue(task.customFields[d.id])) && (
                    <div className="space-y-2.5 rounded-md border p-3">
                      {defs
                        .filter((d) => !isEmptyCustomFieldValue(task.customFields[d.id]))
                        .map((d) => (
                          <div key={d.id} className="grid grid-cols-[140px_1fr] gap-2 text-sm">
                            <span className="text-muted-foreground">{d.label}</span>
                            <CustomFieldValueView def={d} value={task.customFields[d.id]} usersById={usersById} />
                          </div>
                        ))}
                    </div>
                  )}
                  <div>
                    <p className="mb-1 text-sm font-medium">Descrição</p>
                    {task.description ? (
                      <p className="whitespace-pre-wrap text-sm">{task.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">Sem descrição.</p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="subtarefas" className="space-y-3">
                  {task.children.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma subtarefa.</p>}
                  <ul className="divide-y rounded-md border">
                    {task.children.map((child) => (
                      <li key={child.id}>
                        <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/50" onClick={() => onOpenTask(child.id)}>
                          <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, child.number)}</span>
                          <span className="flex-1 truncate">{child.title}</span>
                          <span className="text-xs text-muted-foreground">{child.assignee?.name}</span>
                          <TaskStatusBadge status={child.status} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  {can.update && (
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!newSubtask.trim()) return
                        if (await run(() => quickCreateProjectTask(projectId, { title: newSubtask, parentId: task.id }), "Subtarefa criada")) setNewSubtask("")
                      }}
                    >
                      <Input value={newSubtask} onChange={(e) => setNewSubtask(e.target.value)} placeholder="Nova subtarefa" />
                      <Button type="submit" variant="outline" disabled={busy}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="dependencias" className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm font-medium">Depende de (predecessoras — término → início)</p>
                    {task.predecessors.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
                    <ul className="space-y-1">
                      {task.predecessors.map((dep) => (
                        <li key={dep.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                          <button type="button" className="flex flex-1 items-center gap-2 truncate text-left hover:underline" onClick={() => onOpenTask(dep.predecessor.id)}>
                            <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, dep.predecessor.number)}</span>
                            {dep.predecessor.title}
                          </button>
                          <TaskStatusBadge status={dep.predecessor.status} />
                          {can.update && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(() => removeTaskDependency(projectId, dep.id), "Dependência removida")}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {can.update && (
                      <div className="mt-2 flex gap-2">
                        <Combobox items={predecessorOptions} value={newPredecessor} onValueChange={setNewPredecessor} placeholder="Adicionar predecessora" />
                        <Button
                          variant="outline"
                          disabled={!newPredecessor || busy}
                          onClick={async () => {
                            if (await run(() => addTaskDependency(projectId, { predecessorId: newPredecessor, successorId: task.id }), "Dependência adicionada")) setNewPredecessor("")
                          }}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-medium">Bloqueia (sucessoras)</p>
                    {task.successors.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma.</p>}
                    <ul className="space-y-1">
                      {task.successors.map((dep) => (
                        <li key={dep.id} className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
                          <button type="button" className="flex flex-1 items-center gap-2 truncate text-left hover:underline" onClick={() => onOpenTask(dep.successor.id)}>
                            <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, dep.successor.number)}</span>
                            {dep.successor.title}
                          </button>
                          <TaskStatusBadge status={dep.successor.status} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </TabsContent>

                <TabsContent value="checklist" className="space-y-3">
                  {task.checklistItems.length > 0 && (
                    <ProgressCell value={(checklistDone / task.checklistItems.length) * 100} />
                  )}
                  <ul className="space-y-1">
                    {task.checklistItems.map((item) => (
                      <li key={item.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                        <Checkbox
                          checked={item.done}
                          disabled={!can.update}
                          onCheckedChange={(checked) => run(() => updateChecklistItem(projectId, item.id, { done: !!checked }))}
                        />
                        <span className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>{item.title}</span>
                        {can.update && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100" onClick={() => run(() => deleteChecklistItem(projectId, item.id))}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {can.update && (
                    <form
                      className="flex gap-2"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!newChecklist.trim()) return
                        if (await run(() => addChecklistItem(projectId, task.id, { title: newChecklist }))) setNewChecklist("")
                      }}
                    >
                      <Input value={newChecklist} onChange={(e) => setNewChecklist(e.target.value)} placeholder="Novo item do checklist" />
                      <Button type="submit" variant="outline" disabled={busy}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </form>
                  )}
                </TabsContent>

                <TabsContent value="comentarios" className="space-y-3">
                  {task.comments.length === 0 && <p className="text-sm text-muted-foreground">Nenhum comentário.</p>}
                  <ul className="space-y-3">
                    {task.comments.map((comment) => (
                      <li key={comment.id} className="group rounded-md border p-3">
                        <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{comment.user.name}</span>
                          <span>{formatRelativeTime(comment.createdAt)}</span>
                          {(comment.user.id === currentUserId || can.moderate) && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100"
                              onClick={() => run(() => deleteTaskComment(projectId, comment.id), "Comentário excluído")}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                      </li>
                    ))}
                  </ul>
                  {can.update && (
                    <div className="space-y-2">
                      <Textarea rows={3} value={newComment} onChange={(e) => setNewComment(e.target.value)} placeholder="Escreva um comentário, decisão ou impedimento" />
                      <div className="flex justify-end">
                        <Button
                          size="sm"
                          disabled={!newComment.trim() || busy}
                          onClick={async () => {
                            if (await run(() => addTaskComment(projectId, task.id, { content: newComment }))) setNewComment("")
                          }}
                        >
                          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Comentar
                        </Button>
                      </div>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="horas" className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span>
                      Total apontado: <strong>{formatHours(loggedMinutes, "minutes")}</strong>
                      {task.estimateHours ? <span className="text-muted-foreground"> de {formatHours(task.estimateHours)} estimadas</span> : null}
                    </span>
                    {can.logTime && (
                      <Button size="sm" variant="outline" onClick={() => onLogTime()}>
                        <Plus className="mr-1.5 h-4 w-4" /> Apontar
                      </Button>
                    )}
                  </div>
                  {task.timeEntries.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma hora apontada.</p>}
                  <ul className="divide-y rounded-md border">
                    {task.timeEntries.map((entry) => {
                      const mine = entry.user.id === currentUserId
                      const editable = can.logTime && (mine || can.manageHours)
                      return (
                        <li key={entry.id} className="group flex items-start gap-3 px-3 py-2 text-sm">
                          <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{formatDateOnly(entry.date)}</span>
                          <div className="min-w-0 flex-1">
                            <p className="font-medium">{entry.user.name}</p>
                            {entry.note && <p className="whitespace-pre-wrap text-xs text-muted-foreground">{entry.note}</p>}
                          </div>
                          <span className="tabular-nums">{formatHours(entry.minutes, "minutes")}</span>
                          {editable && (
                            <div className="flex opacity-0 group-hover:opacity-100">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => onLogTime({ id: entry.id, taskId: task.id, userId: entry.user.id, date: entry.date, minutes: entry.minutes, note: entry.note })}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(() => deleteTimeEntry(projectId, entry.id), "Apontamento excluído")}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                </TabsContent>
              </div>
            </Tabs>
            </div>
          </PendingRegion>
        )}

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir tarefa"
          description="Excluir esta tarefa? Tarefas com subtarefas ou horas apontadas não podem ser excluídas."
          confirmLabel="Excluir"
          variant="destructive"
          onConfirm={async () => {
            setConfirmDelete(false)
            if (task && (await run(() => deleteProjectTask(projectId, task.id), "Tarefa excluída"))) onClose()
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
