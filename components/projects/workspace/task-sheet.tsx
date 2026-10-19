"use client"

import { useState } from "react"
import { toast } from "sonner"
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  CircleDot,
  Clock,
  Diamond,
  Flag,
  GitBranch,
  Hourglass,
  Layers,
  Link2,
  ListTodo,
  MessageSquare,
  Pencil,
  Plus,
  SendHorizontal,
  Tags,
  Timer,
  Trash2,
  UserRound,
} from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Combobox } from "@/components/ui/combobox"
import { DatePicker } from "@/components/ui/date-picker"
import { MultiSelect } from "@/components/ui/multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { MarkdownEditor, MarkdownView } from "@/components/shared/markdown-editor"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { PendingRegion } from "@/components/shared/pending-region"
import { OptionSelect } from "@/components/projects/option-select"
import { PhaseBadge, PriorityBadge, ProgressCell, StageBadge } from "@/components/projects/project-badges"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import { PriorityDot, UserAvatar } from "@/components/projects/workspace/task-card-bits"
import {
  addChecklistItem,
  addTaskComment,
  addTaskDependency,
  deleteChecklistItem,
  deleteProjectTask,
  deleteTaskComment,
  moveProjectTask,
  patchProjectTask,
  quickCreateProjectTask,
  removeTaskDependency,
  updateChecklistItem,
} from "@/actions/project-tasks"
import { deleteDemand } from "@/actions/demands"
import { PRIORITIES, PRIORITY_COLORS, PRIORITY_LABELS, formatHours, taskKey, type PhaseRef, type StageRef } from "@/lib/projects"
import { isEmptyCustomFieldValue, type CustomFieldDef } from "@/lib/custom-fields"
import { formatDateOnly, formatRelativeTime } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { TaskDetail, TaskOptions, TeamMember } from "@/components/projects/workspace/types"
import type { ProjectTaskPatch } from "@/schemas/project-task.schema"

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
  stages: StageRef[]
  phases: PhaseRef[]
  /** Assignee choices (project team). */
  team: TeamMember[]
  /** logTime = demands:create, editDemand/deleteDemand = demands:update/delete. */
  can: { update: boolean; delete: boolean; logTime: boolean; editDemand: boolean; deleteDemand: boolean; moderate: boolean }
  onClose: () => void
  onOpenTask: (taskId: string) => void
  onEdit: () => void
  /** New demand for this task (no id) or edit an existing one. */
  onLogTime: (demandId?: string) => void
  refresh: () => void
}

type ActionResult = { success: boolean; error?: string; warning?: string }

/** Borderless control that only shows its frame on hover/focus — the Notion property look. */
const ghost =
  "h-8 border-transparent bg-transparent shadow-none hover:bg-muted focus-visible:bg-background dark:border-transparent dark:bg-transparent dark:hover:bg-muted"

const dateValue = (value: Date | string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "")

function Property({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-9 grid-cols-[150px_1fr] items-center gap-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-4 w-4 shrink-0" /> {label}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  )
}

function Section({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  count?: string | number
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-2 border-b pb-1.5 text-sm font-semibold">
        <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        {count !== undefined && <span className="font-normal text-muted-foreground">{count}</span>}
      </h3>
      {children}
    </section>
  )
}

/** Inline "+ Adicionar…" row: borderless input, Enter submits. */
function AddRow({ placeholder, disabled, onAdd }: { placeholder: string; disabled: boolean; onAdd: (value: string) => Promise<boolean> }) {
  const [value, setValue] = useState("")
  return (
    <form
      className="flex items-center gap-2 rounded-md px-2 text-muted-foreground hover:bg-muted/50"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!value.trim()) return
        if (await onAdd(value)) setValue("")
      }}
    >
      <Plus className="h-4 w-4 shrink-0" />
      <input
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
      />
    </form>
  )
}

/** Number input saved on blur/Enter (estimate, progress). */
function NumberProperty({
  value,
  suffix,
  min,
  max,
  step,
  disabled,
  onSave,
}: {
  value: number | null
  suffix: string
  min: number
  max: number
  step: number
  disabled: boolean
  onSave: (value: number | null) => void
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Input
        key={String(value)}
        type="number"
        min={min}
        max={max}
        step={step}
        defaultValue={value ?? ""}
        disabled={disabled}
        placeholder="Vazio"
        className={cn(ghost, "w-24")}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
        onBlur={(e) => {
          const raw = e.currentTarget.value.trim()
          const next = raw === "" ? null : Math.min(max, Math.max(min, Number(raw)))
          if (next !== value && (next === null || Number.isFinite(next))) onSave(next)
        }}
      />
      <span className="text-xs text-muted-foreground">{suffix}</span>
    </div>
  )
}

/** Rendered markdown; click to edit in the markdown editor (Salvar/Cancelar), like a Notion block. */
function DescriptionBlock({
  value,
  readOnly,
  busy,
  onSave,
}: {
  value: string
  readOnly: boolean
  busy: boolean
  onSave: (value: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<string | null>(null)

  if (draft !== null) {
    return (
      <div className="space-y-2">
        <MarkdownEditor value={draft} onChange={setDraft} height={280} autoFocus label="Descrição da tarefa" placeholder="Contexto, passos, critérios de aceite… (aceita markdown)" />
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            size="sm"
            disabled={busy}
            onClick={async () => {
              if (draft === value || (await onSave(draft))) setDraft(null)
            }}
          >
            Salvar
          </Button>
        </div>
      </div>
    )
  }
  if (!value) {
    return readOnly ? (
      <p className="text-sm text-muted-foreground">Sem descrição.</p>
    ) : (
      <button
        type="button"
        className="-mx-2 w-[calc(100%+1rem)] cursor-text rounded-md px-2 py-3 text-left text-sm text-muted-foreground hover:bg-muted/50"
        onClick={() => setDraft("")}
      >
        Adicione uma descrição, contexto, critérios de aceite…
      </button>
    )
  }
  return (
    <div
      className={cn("-mx-2 rounded-md px-2 py-1", !readOnly && "cursor-text hover:bg-muted/40")}
      onClick={(e) => {
        // Links inside the description stay clickable.
        if (!readOnly && !(e.target as HTMLElement).closest("a")) setDraft(value)
      }}
    >
      <MarkdownView value={value} />
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
  stages,
  phases,
  team,
}: TaskSheetProps) {
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [newComment, setNewComment] = useState("")
  const [newPredecessor, setNewPredecessor] = useState("")

  async function run(action: () => Promise<ActionResult>, success?: string) {
    setBusy(true)
    const result = await action().catch((): ActionResult => ({ success: false }))
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

  /** Inline property edits save silently (only errors/warnings toast), like Notion. */
  const patch = (data: ProjectTaskPatch) => (task ? run(() => patchProjectTask(projectId, task.id, data)) : Promise.resolve(false))

  async function sendComment() {
    if (!task || !newComment.trim()) return
    if (await run(() => addTaskComment(projectId, task.id, { content: newComment }))) setNewComment("")
  }

  // Denormalized total — `demands` is capped at the latest 200.
  const loggedMinutes = task?.loggedMinutes ?? 0
  const checklistDone = task?.checklistItems.filter((i) => i.done).length ?? 0
  const predecessorIds = new Set(task?.predecessors.map((p) => p.predecessorId))
  const predecessorOptions = options.tasks
    .filter((t) => task && t.id !== task.id && !predecessorIds.has(t.id))
    .map((t) => ({ value: t.id, label: `${taskKey(projectCode, t.number)} ${t.title}` }))
  const filledDefs = task ? defs.filter((d) => !isEmptyCustomFieldValue(task.customFields[d.id])) : []
  const currentUserName = usersById[currentUserId] ?? "Você"
  const readOnly = !can.update

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full gap-0 sm:max-w-3xl data-[side=right]:sm:max-w-3xl">
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
          <PendingRegion pending={pending} className="min-h-0 flex-1">
            <div className="flex h-full flex-col">
              {/* Top bar: breadcrumb + page actions */}
              <div className="flex items-center gap-2 border-b px-4 py-2 pr-12 text-xs text-muted-foreground">
                <span className="font-mono">{taskKey(projectCode, task.number)}</span>
                {task.parent && (
                  <button type="button" className="min-w-0 truncate hover:text-foreground hover:underline" onClick={() => onOpenTask(task.parent!.id)}>
                    / {taskKey(projectCode, task.parent.number)} {task.parent.title}
                  </button>
                )}
                <div className="ml-auto flex shrink-0 items-center gap-1">
                  {can.logTime && (
                    <Button size="sm" variant="ghost" onClick={() => onLogTime()}>
                      <Clock className="mr-1.5 h-4 w-4" /> Apontar horas
                    </Button>
                  )}
                  {can.update && (
                    <WithTooltip label="Formulário completo (tarefa pai, campos personalizados)">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onEdit} aria-label="Editar tarefa">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </WithTooltip>
                  )}
                  {can.delete && (
                    <WithTooltip label="Excluir tarefa">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setConfirmDelete(true)} aria-label="Excluir tarefa">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </WithTooltip>
                  )}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="h-1.5" style={{ backgroundColor: PRIORITY_COLORS[task.priority] }} />
                <div className="mx-auto max-w-2xl space-y-8 px-6 py-6 sm:px-10">
                  {/* Title */}
                  <div className="space-y-1">
                    <SheetTitle className="sr-only">{task.title}</SheetTitle>
                    <SheetDescription className="sr-only">Detalhes da tarefa</SheetDescription>
                    <div className="flex items-start gap-2">
                      {task.isMilestone && <Diamond className="mt-2.5 h-5 w-5 shrink-0 fill-amber-500 text-amber-500" />}
                      <Textarea
                        key={`${task.id}:${task.title}`}
                        rows={1}
                        defaultValue={task.title}
                        readOnly={readOnly}
                        aria-label="Título da tarefa"
                        className="min-h-0 resize-none border-transparent bg-transparent px-0 py-1 text-2xl font-bold leading-tight shadow-none focus-visible:border-transparent focus-visible:ring-0 md:text-2xl dark:bg-transparent"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault()
                            e.currentTarget.blur()
                          }
                          if (e.key === "Escape") {
                            e.currentTarget.value = task.title
                            e.currentTarget.blur()
                          }
                        }}
                        onBlur={(e) => {
                          const title = e.currentTarget.value.trim()
                          if (!title) e.currentTarget.value = task.title
                          else if (title !== task.title) void patch({ title })
                        }}
                      />
                    </div>
                  </div>

                  {/* Properties */}
                  <div className="space-y-0.5">
                    <Property icon={CircleDot} label="Etapa">
                      {readOnly ? (
                        <StageBadge stage={stages.find((st) => st.id === task.stageId)} />
                      ) : (
                        <OptionSelect
                          className={cn(ghost, "w-fit min-w-40")}
                          options={stages.map((st) => ({ value: st.id, label: st.name, color: st.color }))}
                          value={task.stageId}
                          onChange={(stageId) => stageId && stageId !== task.stageId && run(() => moveProjectTask(projectId, task.id, { stageId }))}
                        />
                      )}
                    </Property>
                    <Property icon={Flag} label="Prioridade">
                      {readOnly ? (
                        <PriorityBadge priority={task.priority} />
                      ) : (
                        <OptionSelect
                          className={cn(ghost, "w-fit min-w-40")}
                          options={[...PRIORITIES].reverse().map((p) => ({ value: p, label: PRIORITY_LABELS[p], color: PRIORITY_COLORS[p] }))}
                          value={task.priority}
                          onChange={(priority) => priority && priority !== task.priority && patch({ priority: priority as (typeof PRIORITIES)[number] })}
                        />
                      )}
                    </Property>
                    <Property icon={UserRound} label="Responsável">
                      {readOnly ? (
                        (task.assignee?.name ?? <span className="text-muted-foreground">Vazio</span>)
                      ) : (
                        <OptionSelect
                          className={cn(ghost, "w-fit min-w-48")}
                          emptyLabel="Sem responsável"
                          options={team.map((m) => ({ value: m.id, label: m.name }))}
                          value={task.assigneeId}
                          onChange={(id) => (id || null) !== task.assigneeId && patch({ assigneeId: id || null })}
                        />
                      )}
                    </Property>
                    <Property icon={Layers} label="Fase">
                      {readOnly || phases.length === 0 ? (
                        <PhaseBadge phase={phases.find((ph) => ph.id === task.phaseId)} />
                      ) : (
                        <OptionSelect
                          className={cn(ghost, "w-fit min-w-48")}
                          emptyLabel="Sem fase"
                          options={phases.map((ph) => ({ value: ph.id, label: ph.name, color: ph.color }))}
                          value={task.phaseId}
                          onChange={(id) => (id || null) !== task.phaseId && patch({ phaseId: id || null })}
                        />
                      )}
                    </Property>
                    <Property icon={CalendarDays} label="Início">
                      <DatePicker
                        className={cn(ghost, "w-48")}
                        placeholder="Vazio"
                        disabled={readOnly}
                        value={dateValue(task.startDate)}
                        onValueChange={(v) => v !== dateValue(task.startDate) && patch({ startDate: v || null })}
                      />
                    </Property>
                    <Property icon={CalendarClock} label="Prazo">
                      <DatePicker
                        className={cn(ghost, "w-48")}
                        placeholder="Vazio"
                        disabled={readOnly}
                        value={dateValue(task.dueDate)}
                        onValueChange={(v) => v !== dateValue(task.dueDate) && patch({ dueDate: v || null })}
                      />
                    </Property>
                    <Property icon={Hourglass} label="Estimativa">
                      <NumberProperty
                        value={task.estimateHours}
                        suffix="horas"
                        min={0}
                        max={100000}
                        step={0.5}
                        disabled={readOnly}
                        onSave={(estimateHours) => void patch({ estimateHours })}
                      />
                    </Property>
                    <Property icon={Timer} label="Horas apontadas">
                      <span className="px-2.5 tabular-nums">
                        {formatHours(task.loggedMinutes, "minutes")}
                        {task.estimateHours ? <span className="text-muted-foreground"> de {formatHours(task.estimateHours)}</span> : null}
                      </span>
                    </Property>
                    <Property icon={ListTodo} label="Progresso">
                      <div className="flex items-center gap-3">
                        <NumberProperty
                          value={task.progress}
                          suffix="%"
                          min={0}
                          max={100}
                          step={5}
                          disabled={readOnly}
                          onSave={(progress) => void patch({ progress: progress ?? 0 })}
                        />
                        <div className="w-40">
                          <ProgressCell value={task.status === "DONE" ? 100 : task.progress} />
                        </div>
                      </div>
                    </Property>
                    <Property icon={Diamond} label="Marco">
                      <div className="px-2.5">
                        <Switch checked={task.isMilestone} disabled={readOnly} onCheckedChange={(checked) => patch({ isMilestone: !!checked })} />
                      </div>
                    </Property>
                    <Property icon={Tags} label="Tags">
                      {readOnly ? (
                        task.tags.length ? (
                          <div className="flex flex-wrap gap-1">
                            {task.tags.map((t) => (
                              <ColorBadge key={t.id} label={t.name} color={t.color} />
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Vazio</span>
                        )
                      ) : (
                        <MultiSelect
                          className={cn(ghost, "h-auto min-h-8")}
                          placeholder="Vazio"
                          searchPlaceholder="Buscar tag..."
                          items={options.tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
                          value={task.tags.map((t) => t.id)}
                          onValueChange={(tagIds) => patch({ tagIds })}
                        />
                      )}
                    </Property>
                    {task.completedAt && (
                      <Property icon={CalendarCheck} label="Concluída em">
                        <span className="px-2.5">{formatDateOnly(task.completedAt)}</span>
                      </Property>
                    )}
                    {filledDefs.map((d) => (
                      <Property key={d.id} icon={CheckSquare} label={d.label}>
                        <div className="px-2.5">
                          <CustomFieldValueView def={d} value={task.customFields[d.id]} usersById={usersById} />
                        </div>
                      </Property>
                    ))}
                  </div>

                  {/* Description */}
                  <div className="border-t pt-4">
                    <DescriptionBlock
                      key={task.id}
                      value={task.description ?? ""}
                      readOnly={readOnly}
                      busy={busy}
                      onSave={(description) => patch({ description: description || null })}
                    />
                  </div>

                  {/* Subtasks */}
                  <Section icon={GitBranch} title="Subtarefas" count={task.children.length || undefined}>
                    {task.children.length > 0 && (
                      <ul className="space-y-0.5">
                        {task.children.map((child) => (
                          <li key={child.id}>
                            <button
                              type="button"
                              className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
                              onClick={() => onOpenTask(child.id)}
                            >
                              <PriorityDot priority={child.priority} />
                              <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, child.number)}</span>
                              <span className={cn("flex-1 truncate", child.status === "DONE" && "text-muted-foreground line-through")}>{child.title}</span>
                              <span className="text-xs text-muted-foreground">{child.assignee?.name}</span>
                              <StageBadge stage={child.stage} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {can.update && (
                      <AddRow
                        placeholder="Nova subtarefa"
                        disabled={busy}
                        onAdd={(title) => run(() => quickCreateProjectTask(projectId, { title, parentId: task.id }), "Subtarefa criada")}
                      />
                    )}
                  </Section>

                  {/* Checklist */}
                  <Section icon={CheckSquare} title="Checklist" count={task.checklistItems.length ? `${checklistDone}/${task.checklistItems.length}` : undefined}>
                    {task.checklistItems.length > 0 && <ProgressCell value={(checklistDone / task.checklistItems.length) * 100} />}
                    <ul className="space-y-0.5">
                      {task.checklistItems.map((item) => (
                        <li key={item.id} className="group flex items-center gap-2 rounded-md px-2 py-1 hover:bg-muted/50">
                          <Checkbox
                            checked={item.done}
                            disabled={!can.update}
                            onCheckedChange={(checked) => run(() => updateChecklistItem(projectId, item.id, { done: !!checked }))}
                          />
                          <span className={cn("flex-1 text-sm", item.done && "text-muted-foreground line-through")}>{item.title}</span>
                          {can.update && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100"
                              aria-label="Remover item"
                              onClick={() => run(() => deleteChecklistItem(projectId, item.id))}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                    {can.update && <AddRow placeholder="Adicionar item" disabled={busy} onAdd={(title) => run(() => addChecklistItem(projectId, task.id, { title }))} />}
                  </Section>

                  {/* Dependencies */}
                  <Section icon={Link2} title="Dependências" count={task.predecessors.length + task.successors.length || undefined}>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Depende de (término → início)</p>
                        {task.predecessors.length === 0 && <p className="px-2 text-sm text-muted-foreground">Nenhuma.</p>}
                        {task.predecessors.map((dep) => (
                          <div key={dep.id} className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-muted/50">
                            <button type="button" className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-left" onClick={() => onOpenTask(dep.predecessor.id)}>
                              <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, dep.predecessor.number)}</span>
                              <span className="truncate">{dep.predecessor.title}</span>
                            </button>
                            <StageBadge stage={dep.predecessor.stage} />
                            {can.update && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100"
                                aria-label="Remover dependência"
                                onClick={() => run(() => removeTaskDependency(projectId, dep.id), "Dependência removida")}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        ))}
                        {can.update && (
                          <div className="flex gap-2 pt-1">
                            <Combobox items={predecessorOptions} value={newPredecessor} onValueChange={setNewPredecessor} placeholder="Adicionar predecessora" />
                            <Button
                              variant="outline"
                              disabled={!newPredecessor || busy}
                              aria-label="Adicionar dependência"
                              onClick={async () => {
                                if (await run(() => addTaskDependency(projectId, { predecessorId: newPredecessor, successorId: task.id }), "Dependência adicionada")) setNewPredecessor("")
                              }}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Bloqueia</p>
                        {task.successors.length === 0 && <p className="px-2 text-sm text-muted-foreground">Nenhuma.</p>}
                        {task.successors.map((dep) => (
                          <button
                            key={dep.id}
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-muted/50"
                            onClick={() => onOpenTask(dep.successor.id)}
                          >
                            <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, dep.successor.number)}</span>
                            <span className="flex-1 truncate">{dep.successor.title}</span>
                            <StageBadge stage={dep.successor.stage} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </Section>

                  {/* Demands / hours */}
                  <Section icon={Clock} title="Horas apontadas" count={formatHours(loggedMinutes, "minutes")}>
                    <p className="text-xs text-muted-foreground">As horas da tarefa são as demandas vinculadas a ela — também aparecem em Demandas e consomem o contrato do cliente.</p>
                    {task.demands.length === 0 && <p className="px-2 text-sm text-muted-foreground">Nenhuma demanda vinculada.</p>}
                    <ul className="space-y-0.5">
                      {task.demands.map((demand) => {
                        const mine = demand.analyst.userId === currentUserId
                        return (
                          <li key={demand.id} className="group flex items-start gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-muted/50">
                            <span className="w-20 shrink-0 tabular-nums text-muted-foreground">{formatDateOnly(demand.date)}</span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-medium">{demand.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {demand.analyst.name}
                                {mine && " (você)"}
                              </p>
                            </div>
                            <span className="tabular-nums">{formatHours(demand.durationMinutes, "minutes")}</span>
                            {(can.editDemand || can.deleteDemand) && (
                              <div className="flex opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100">
                                {can.editDemand && (
                                  <WithTooltip label="Editar demanda">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onLogTime(demand.id)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </WithTooltip>
                                )}
                                {can.deleteDemand && (
                                  <WithTooltip label="Excluir demanda">
                                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => run(() => deleteDemand(demand.id), "Demanda excluída")}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </WithTooltip>
                                )}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                    {can.logTime && (
                      <button
                        type="button"
                        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-muted-foreground hover:bg-muted/50"
                        onClick={() => onLogTime()}
                      >
                        <Plus className="h-4 w-4" /> Apontar horas
                      </button>
                    )}
                  </Section>

                  {/* Comments */}
                  <Section icon={MessageSquare} title="Comentários" count={task.comments.length || undefined}>
                    <ul className="space-y-4">
                      {task.comments.map((comment) => (
                        <li key={comment.id} className="group flex gap-3">
                          <UserAvatar name={comment.user.name} image={comment.user.image} className="mt-0.5 h-7 w-7" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="font-semibold">{comment.user.name}</span>
                              <span className="text-muted-foreground">{formatRelativeTime(comment.createdAt)}</span>
                              {(comment.user.id === currentUserId || can.moderate) && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100"
                                  aria-label="Excluir comentário"
                                  onClick={() => run(() => deleteTaskComment(projectId, comment.id), "Comentário excluído")}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              )}
                            </div>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed">{comment.content}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    {can.update && (
                      <div className="flex gap-3 pt-2">
                        <UserAvatar name={currentUserName} className="mt-1 h-7 w-7" />
                        <div className="flex-1 rounded-lg border bg-background focus-within:ring-2 focus-within:ring-ring/40">
                          <Textarea
                            rows={1}
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                                e.preventDefault()
                                void sendComment()
                              }
                            }}
                            placeholder="Adicionar um comentário…"
                            className="min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                          />
                          <div className="flex items-center justify-between px-2.5 pb-2">
                            <span className="text-[11px] text-muted-foreground">Ctrl/⌘ + Enter para enviar</span>
                            <Button size="icon" className="h-7 w-7" disabled={!newComment.trim() || busy} onClick={() => void sendComment()} aria-label="Enviar comentário">
                              <SendHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Section>
                </div>
              </div>
            </div>
          </PendingRegion>
        )}

        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title="Excluir tarefa"
          description="Excluir esta tarefa? Tarefas com subtarefas ou demandas vinculadas não podem ser excluídas."
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
