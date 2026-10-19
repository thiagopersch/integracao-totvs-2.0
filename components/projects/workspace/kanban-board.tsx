"use client"

import { Fragment, memo, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { CalendarDays, MoreHorizontal, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColorBadge } from "@/components/shared/color-badge"
import { PhaseBadge, PriorityBadge, StageBadge } from "@/components/projects/project-badges"
import { DueDateLabel, TaskMeta, UserAvatar } from "@/components/projects/workspace/task-card-bits"
import { moveProjectTask, quickCreateProjectTask } from "@/actions/project-tasks"
import { PRIORITIES, PRIORITY_COLORS, PRIORITY_LABELS, byPriority, taskKey, type PhaseRef, type ProjectSettings, type StageRef } from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import { sameRankNeighbours } from "@/lib/project-tasks"
import type { Swimlane } from "@/lib/project-workspace-params"
import { cn } from "@/lib/utils"
import type { ProjectTaskDTO, WorkspaceActions } from "@/components/projects/workspace/types"
import { openTaskMenuFrom, type TaskContextMenu } from "@/components/projects/workspace/task-context-menu"

const SEP = "::"
const containerId = (lane: string, stageId: string) => `${lane}${SEP}${stageId}`
const stageOf = (container: string) => container.split(SEP)[1]

type Lane = { id: string; label: string }

interface KanbanBoardProps {
  projectId: string
  projectCode: string
  tasks: ProjectTaskDTO[]
  settings: ProjectSettings
  /** Visible workflow stages (kanban columns), in order. */
  stages: StageRef[]
  phases: PhaseRef[]
  swimlane: Swimlane
  today: string
  canCreate: boolean
  canUpdate: boolean
  actions: WorkspaceActions
  taskMenu: TaskContextMenu
}

function laneKey(task: ProjectTaskDTO, swimlane: Swimlane) {
  if (swimlane === "assignee") return task.assigneeId ?? "none"
  if (swimlane === "priority") return task.priority
  return "all"
}

function buildColumns(tasks: ProjectTaskDTO[], lanes: Lane[], stages: StageRef[], swimlane: Swimlane) {
  const columns: Record<string, string[]> = {}
  for (const lane of lanes) for (const stage of stages) columns[containerId(lane.id, stage.id)] = []
  // Urgente → Alta → Média → Baixa; the manual (drag) order applies within the same priority.
  const sorted = [...tasks].sort((a, b) => byPriority(a, b) || a.boardPosition - b.boardPosition || a.number - b.number)
  for (const task of sorted) {
    if (!task.stageId) continue
    const key = containerId(laneKey(task, swimlane), task.stageId)
    if (columns[key]) columns[key].push(task.id)
  }
  return columns
}

type CardProps = {
  task: ProjectTaskDTO
  /** Column the card is in — shown right away after a drop, before the server confirms. */
  stage?: StageRef
  phase?: PhaseRef
  projectCode: string
  today: string
  onOpen?: (taskId: string) => void
  /** Shows the "⋯" menu button on touch screens (no right click there). */
  menu?: boolean
  dragging?: boolean
}

/** Soft tint + left stripe in the priority color over the opaque card, so text keeps the theme contrast. */
const KanbanCard = memo(function KanbanCard({ task, stage, phase, projectCode, today, onOpen, menu, dragging }: CardProps) {
  const color = PRIORITY_COLORS[task.priority]
  const progress = task.status === "DONE" ? 100 : task.progress
  return (
    <div
      onClick={() => onOpen?.(task.id)}
      className={cn(
        "neon-border cursor-pointer space-y-2 rounded-md border bg-card p-2.5 text-left shadow-xs outline-none hover:shadow-md",
        dragging && "neon-off cursor-grabbing rotate-1 shadow-lg ring-2 ring-primary/40",
        task.status === "CANCELLED" && "opacity-70"
      )}
      style={{ backgroundImage: `linear-gradient(${color}1f, ${color}1f)`, borderLeft: `4px solid ${color}`, "--neon": color } as React.CSSProperties}
    >
      <div className="flex items-start gap-2">
        <p className={cn("flex-1 text-sm font-medium leading-snug", task.status === "DONE" && "text-muted-foreground line-through")}>{task.title}</p>
        <PriorityBadge priority={task.priority} />
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {stage && <StageBadge stage={stage} />}
        {phase && <PhaseBadge phase={phase} />}
        {task.tags.slice(0, 3).map((t) => (
          <ColorBadge key={t.id} label={t.name} color={t.color} />
        ))}
        {task.tags.length > 3 && <span className="text-[11px] text-muted-foreground">+{task.tags.length - 3}</span>}
      </div>
      {(task.startDate || task.dueDate) && (
        <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
          {task.startDate && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3 w-3" /> {formatDateOnly(task.startDate)}
            </span>
          )}
          {task.startDate && task.dueDate && <span>→</span>}
          <DueDateLabel task={task} today={today} />
        </div>
      )}
      {progress > 0 && (
        <div className="h-1 overflow-hidden rounded-full bg-foreground/10">
          <div className="h-full" style={{ width: `${progress}%`, backgroundColor: color }} />
        </div>
      )}
      <TaskMeta task={task} />
      <div className="flex items-center justify-between gap-2 border-t border-foreground/10 pt-2">
        <span className="font-mono text-[11px] text-muted-foreground">{taskKey(projectCode, task.number)}</span>
        <span className="ml-auto flex min-w-0 items-center gap-1.5">
          {task.assignee ? (
            <span className="flex min-w-0 items-center gap-1.5 text-xs">
              <span className="truncate">{task.assignee.name}</span>
              <UserAvatar name={task.assignee.name} image={task.assignee.image} className="h-5 w-5" />
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">Sem responsável</span>
          )}
          {menu && (
            <button
              type="button"
              className="-my-1 -mr-1 hidden h-7 w-7 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background/60 pointer-coarse:inline-flex"
              aria-label="Ações da tarefa"
              onClick={(e) => {
                e.stopPropagation()
                openTaskMenuFrom(e.currentTarget)
              }}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          )}
        </span>
      </div>
    </div>
  )
})

/**
 * Draggable wrapper — the only focus stop of the card (Enter opens it, Space picks it up). Touch
 * drags start after a press-and-hold, so swiping over cards still scrolls the board/page.
 */
function SortableCard(props: Omit<CardProps, "dragging" | "menu"> & { disabled: boolean }) {
  const { disabled, ...card } = props
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id, disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-manipulation select-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring [-webkit-touch-callout:none]", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
      onKeyDown={(e) => {
        listeners?.onKeyDown?.(e)
        if (e.key === "Enter" && e.target === e.currentTarget) card.onOpen?.(card.task.id)
      }}
    >
      <KanbanCard {...card} menu />
    </div>
  )
}

/** Inline title input of the quick add (header "+" opens it at the top, "Adicionar" at the bottom). */
function QuickAddForm({ onAdd, onClose }: { onAdd: (title: string) => Promise<boolean>; onClose: () => void }) {
  const [title, setTitle] = useState("")
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (!title.trim()) return onClose()
        if (await onAdd(title)) setTitle("")
      }}
    >
      <Input
        autoFocus
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={() => !title && onClose()}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        placeholder="Título da tarefa + Enter"
        className="h-8 bg-card"
      />
    </form>
  )
}

/** Icon-only "+" next to a column's task count. */
function HeaderAddButton({ stage, full, onClick }: { stage: StageRef; full: boolean; onClick: () => void }) {
  const label = full ? `Limite WIP de "${stage.name}" atingido` : `Adicionar tarefa em ${stage.name}`
  return (
    <Button
      variant="ghost"
      size="icon"
      className="-my-1 -mr-1.5 h-6 w-6 text-muted-foreground hover:bg-background/60"
      disabled={full}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      <Plus className="h-4 w-4" />
    </Button>
  )
}

function Column({
  id,
  stage,
  ids,
  tasksById,
  phasesById,
  limit,
  wipFull,
  showHeader,
  projectCode,
  today,
  canCreate,
  canUpdate,
  onOpen,
  onQuickAdd,
  taskMenu,
  isDragging,
}: {
  id: string
  stage: StageRef
  ids: string[]
  tasksById: Map<string, ProjectTaskDTO>
  phasesById: Map<string, PhaseRef>
  limit?: number
  /** Column already holds its WIP limit and the project enforces it: creating here is blocked. */
  wipFull: boolean
  showHeader: boolean
  projectCode: string
  today: string
  canCreate: boolean
  canUpdate: boolean
  onOpen: (id: string) => void
  onQuickAdd: (stageId: string, title: string) => Promise<boolean>
  taskMenu: TaskContextMenu
  isDragging: () => boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [adding, setAdding] = useState<"top" | "bottom" | null>(null)
  const exceeded = !!limit && ids.length > limit

  return (
    <div
      className={cn("flex w-72 shrink-0 flex-col rounded-lg border border-transparent transition-colors", exceeded && "ring-1 ring-destructive/60")}
      style={{ backgroundColor: `${stage.color}${isOver ? "40" : "26"}`, borderTop: `3px solid ${stage.color}` }}
    >
      {showHeader && (
        <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${stage.color}33` }}>
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
          <span className="truncate text-sm font-medium">{stage.name}</span>
          <span className={cn("ml-auto text-xs tabular-nums", exceeded ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {ids.length}
            {limit ? ` / ${limit}` : ""}
          </span>
          {canCreate && <HeaderAddButton stage={stage} full={wipFull} onClick={() => setAdding("top")} />}
        </div>
      )}
      <div ref={setNodeRef} className="flex min-h-24 flex-1 flex-col gap-2 p-2">
        {canCreate && adding === "top" && <QuickAddForm onAdd={(title) => onQuickAdd(stage.id, title)} onClose={() => setAdding(null)} />}
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((taskId) => {
            const task = tasksById.get(taskId)
            return task ? (
              <Fragment key={taskId}>
                {taskMenu.wrap(
                  task,
                  <SortableCard
                    task={task}
                    stage={stage}
                    phase={task.phaseId ? phasesById.get(task.phaseId) : undefined}
                    projectCode={projectCode}
                    today={today}
                    onOpen={onOpen}
                    disabled={!canUpdate}
                  />,
                  { blockOpen: isDragging }
                )}
              </Fragment>
            ) : null
          })}
        </SortableContext>
        {canCreate &&
          (adding === "bottom" ? (
            <QuickAddForm onAdd={(title) => onQuickAdd(stage.id, title)} onClose={() => setAdding(null)} />
          ) : (
            adding !== "top" && (
              <Button
                variant="ghost"
                size="sm"
                className="justify-start text-muted-foreground hover:bg-background/60"
                disabled={wipFull}
                onClick={() => setAdding("bottom")}
              >
                <Plus className="mr-1 h-4 w-4" /> Adicionar
              </Button>
            )
          ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ projectId, projectCode, tasks, settings, stages, phases, swimlane, today, canCreate, canUpdate, actions, taskMenu }: KanbanBoardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const phasesById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases])
  const stagesById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])

  const lanes: Lane[] = useMemo(() => {
    if (swimlane === "priority") return [...PRIORITIES].reverse().map((p) => ({ id: p, label: `Prioridade ${PRIORITY_LABELS[p]}` }))
    if (swimlane === "assignee") {
      const seen = new Map<string, string>()
      for (const t of tasks) seen.set(t.assigneeId ?? "none", t.assignee?.name ?? "Sem responsável")
      return [...seen.entries()]
        .sort((a, b) => (a[0] === "none" ? 1 : b[0] === "none" ? -1 : a[1].localeCompare(b[1], "pt-BR")))
        .map(([id, label]) => ({ id, label }))
    }
    return [{ id: "all", label: "" }]
  }, [swimlane, tasks])

  // Server data wins whenever it changes (after a refresh or a filter change); local state only
  // holds the optimistic order while dragging.
  const base = useMemo(() => buildColumns(tasks, lanes, stages, swimlane), [tasks, lanes, stages, swimlane])
  const [board, setBoard] = useState({ base, columns: base })
  if (board.base !== base) setBoard({ base, columns: base })
  const columns = board.columns
  const setColumns = (next: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) =>
    setBoard((prev) => ({ ...prev, columns: typeof next === "function" ? next(prev.columns) : next }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)
  // Read by the card menus to veto the touch long-press while a card is lifted.
  const draggingRef = useRef(false)
  const isDragging = () => draggingRef.current

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Press and hold to drag on touch screens; a swipe before that scrolls.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    // Enter opens the task (card onKeyDown), so only Space picks up / drops.
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] } })
  )

  /** Tasks per stage across lanes (WIP counts). */
  const stageCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const t of tasks) if (t.stageId) counts.set(t.stageId, (counts.get(t.stageId) ?? 0) + 1)
    return counts
  }, [tasks])

  const findContainer = (id: string) => (id in columns ? id : Object.keys(columns).find((key) => columns[key].includes(id)))

  function refresh() {
    startTransition(() => router.refresh())
  }

  function resetBoard() {
    setColumns(base)
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    draggingRef.current = true
    setActiveId(id)
    setOrigin(findContainer(id) ?? null)
    // Haptic tick when the hold lifts the card (no-op where unsupported, e.g. iOS Safari).
    if (typeof TouchEvent !== "undefined" && event.activatorEvent instanceof TouchEvent) navigator.vibrate?.(10)
  }

  function onDragOver(event: DragOverEvent) {
    const { active, over } = event
    if (!over) return
    const from = findContainer(String(active.id))
    const to = findContainer(String(over.id))
    if (!from || !to || from === to) return
    setColumns((prev) => {
      const target = prev[to].filter((id) => id !== active.id)
      const overIndex = target.indexOf(String(over.id))
      const index = overIndex >= 0 ? overIndex : target.length
      return {
        ...prev,
        [from]: prev[from].filter((id) => id !== active.id),
        [to]: [...target.slice(0, index), String(active.id), ...target.slice(index)],
      }
    })
  }

  async function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    const id = String(active.id)
    draggingRef.current = false
    setActiveId(null)
    const container = findContainer(id)
    const task = tasksById.get(id)
    if (!over || !container || !task) return resetBoard()

    // Reorder inside the final container.
    let ids = columns[container]
    const overIndex = ids.indexOf(String(over.id))
    const activeIndex = ids.indexOf(id)
    if (overIndex >= 0 && activeIndex >= 0 && overIndex !== activeIndex) {
      ids = [...ids]
      ids.splice(activeIndex, 1)
      ids.splice(overIndex, 0, id)
      setColumns((prev) => ({ ...prev, [container]: ids }))
    }

    const stageId = stageOf(container)
    const stage = stagesById.get(stageId)
    if (!stage) return resetBoard()
    const index = ids.indexOf(id)
    if (stageId === task.stageId && origin === container && activeIndex === index) return

    // WIP limit (column total across lanes, without the moved card).
    const limit = stage.wipLimit
    if (limit && settings.wipEnforced && stageId !== task.stageId && (stageCounts.get(stageId) ?? 0) >= limit) {
      toast.error(`Limite WIP de "${stage.name}" atingido (${limit}).`)
      return resetBoard()
    }
    if (swimlane !== "none" && origin && origin.split(SEP)[0] !== container.split(SEP)[0]) {
      toast.info("Mover entre raias altera apenas o status — edite a tarefa para trocar responsável ou prioridade.")
    }

    // Cards are shown by priority first, so the drop position is defined by the same-priority neighbours.
    const { beforeId, afterId } = sameRankNeighbours(ids, id, (taskId) => tasksById.get(taskId)?.priority)
    try {
      const result = await moveProjectTask(projectId, id, { stageId, beforeId, afterId })
      if (!result.success) {
        toast.error(result.error || "Erro ao mover tarefa")
        resetBoard()
      } else if (result.warning) toast.warning(result.warning)
    } catch {
      toast.error("Erro ao mover tarefa")
      resetBoard()
    }
    refresh()
  }

  async function quickAdd(stageId: string, title: string, lane: string) {
    const result = await quickCreateProjectTask(projectId, { title, stageId }).catch(() => null)
    if (!result?.success) {
      toast.error(result?.error || "Erro ao criar tarefa")
      return false
    }
    if (lane !== "all") toast.info("Tarefa criada — defina responsável/prioridade ao editá-la.")
    refresh()
    return true
  }

  const activeTask = activeId ? tasksById.get(activeId) : null
  const countIn = (stageId: string) => stageCounts.get(stageId) ?? 0
  const wipFull = (stage: StageRef) => !!stage.wipLimit && !!settings.wipEnforced && countIn(stage.id) >= stage.wipLimit

  return (
    <DndContext
      // Stable id keeps dnd-kit's aria-describedby equal on server and client (no hydration mismatch).
      id={`kanban-${projectId}`}
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        draggingRef.current = false
        setActiveId(null)
        resetBoard()
      }}
    >
      {/* Scrolls with the screen width (trackpad, shift+wheel, auto-scroll while dragging) but the bar stays hidden. */}
      <div className="no-scrollbar overflow-x-auto">
        <div className="inline-flex min-w-full flex-col gap-4">
          {swimlane !== "none" && (
            <div className="flex gap-3">
              {stages.map((stage) => {
                const count = countIn(stage.id)
                const limit = stage.wipLimit
                return (
                  <div key={stage.id} className="flex w-72 shrink-0 items-center gap-2 px-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: stage.color }} />
                    <span className="truncate text-sm font-medium">{stage.name}</span>
                    <span className={cn("ml-auto text-xs tabular-nums", limit && count > limit ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {count}
                      {limit ? ` / ${limit}` : ""}
                    </span>
                    {/* Lanes split the column, so the header "+" opens the full form (stage prefilled). */}
                    {canCreate && <HeaderAddButton stage={stage} full={wipFull(stage)} onClick={() => actions.newTask({ stageId: stage.id })} />}
                  </div>
                )
              })}
            </div>
          )}
          {lanes.map((lane) => (
            <div key={lane.id} className="space-y-2">
              {swimlane !== "none" && <p className="px-1 text-sm font-semibold text-muted-foreground">{lane.label}</p>}
              <div className="flex items-stretch gap-3">
                {stages.map((stage) => {
                  const id = containerId(lane.id, stage.id)
                  return (
                    <Column
                      key={id}
                      id={id}
                      stage={stage}
                      ids={columns[id] ?? []}
                      tasksById={tasksById}
                      phasesById={phasesById}
                      limit={swimlane === "none" ? (stage.wipLimit ?? undefined) : undefined}
                      wipFull={wipFull(stage)}
                      showHeader={swimlane === "none"}
                      projectCode={projectCode}
                      today={today}
                      canCreate={canCreate}
                      canUpdate={canUpdate}
                      onOpen={actions.openTask}
                      onQuickAdd={(s, title) => quickAdd(s, title, lane.id)}
                      taskMenu={taskMenu}
                      isDragging={isDragging}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DragOverlay>
        {activeTask ? (
          <KanbanCard
            task={activeTask}
            stage={stagesById.get(stageOf(findContainer(activeTask.id) ?? "") ?? "")}
            phase={activeTask.phaseId ? phasesById.get(activeTask.phaseId) : undefined}
            projectCode={projectCode}
            today={today}
            dragging
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

/** Columns shown: the stage filter if any, otherwise every stage except cancelled ones (unless asked). */
export function kanbanStages(stages: StageRef[], stageFilter: string[], showCancelled: boolean): StageRef[] {
  if (stageFilter.length) return stages.filter((s) => stageFilter.includes(s.id))
  return stages.filter((s) => s.category !== "CANCELLED" || showCancelled)
}
