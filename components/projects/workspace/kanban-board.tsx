"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
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
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ColorBadge } from "@/components/shared/color-badge"
import { DueDateLabel, PriorityDot, TaskMeta, UserAvatar } from "@/components/projects/workspace/task-card-bits"
import { moveProjectTask, quickCreateProjectTask } from "@/actions/project-tasks"
import {
  PRIORITIES,
  PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  taskKey,
  type ProjectSettings,
  type TaskStatus,
} from "@/lib/projects"
import type { Swimlane } from "@/lib/project-workspace-params"
import { cn } from "@/lib/utils"
import type { ProjectTaskDTO, WorkspaceActions } from "@/components/projects/workspace/types"

const SEP = "::"
const containerId = (lane: string, status: TaskStatus) => `${lane}${SEP}${status}`
const statusOf = (container: string) => container.split(SEP)[1] as TaskStatus

type Lane = { id: string; label: string }

interface KanbanBoardProps {
  projectId: string
  projectCode: string
  tasks: ProjectTaskDTO[]
  settings: ProjectSettings
  statuses: TaskStatus[]
  swimlane: Swimlane
  today: string
  canCreate: boolean
  canUpdate: boolean
  actions: WorkspaceActions
}

function laneKey(task: ProjectTaskDTO, swimlane: Swimlane) {
  if (swimlane === "assignee") return task.assigneeId ?? "none"
  if (swimlane === "priority") return task.priority
  return "all"
}

function buildColumns(tasks: ProjectTaskDTO[], lanes: Lane[], statuses: TaskStatus[], swimlane: Swimlane) {
  const columns: Record<string, string[]> = {}
  for (const lane of lanes) for (const status of statuses) columns[containerId(lane.id, status)] = []
  const sorted = [...tasks].sort((a, b) => a.boardPosition - b.boardPosition || a.number - b.number)
  for (const task of sorted) {
    const key = containerId(laneKey(task, swimlane), task.status)
    if (columns[key]) columns[key].push(task.id)
  }
  return columns
}

function KanbanCard({
  task,
  projectCode,
  today,
  onOpen,
  dragging,
}: {
  task: ProjectTaskDTO
  projectCode: string
  today: string
  onOpen?: () => void
  dragging?: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen?.()}
      className={cn(
        "space-y-2 rounded-md border bg-card p-2.5 text-left shadow-xs transition-shadow hover:shadow-md",
        dragging && "rotate-1 shadow-lg ring-2 ring-primary/40"
      )}
    >
      <div className="flex items-start gap-2">
        <PriorityDot priority={task.priority} />
        <p className="flex-1 text-sm font-medium leading-snug">{task.title}</p>
        {task.assignee && <UserAvatar name={task.assignee.name} image={task.assignee.image} />}
      </div>
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((t) => (
            <ColorBadge key={t.id} label={t.name} color={t.color} />
          ))}
        </div>
      )}
      {task.progress > 0 && task.status !== "DONE" && (
        <div className="h-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full bg-primary" style={{ width: `${task.progress}%` }} />
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-muted-foreground">{taskKey(projectCode, task.number)}</span>
        <DueDateLabel task={task} today={today} />
      </div>
      <TaskMeta task={task} />
    </div>
  )
}

function SortableCard(props: { task: ProjectTaskDTO; projectCode: string; today: string; onOpen: () => void; disabled: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: props.task.id, disabled: props.disabled })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("touch-none", isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <KanbanCard task={props.task} projectCode={props.projectCode} today={props.today} onOpen={props.onOpen} />
    </div>
  )
}

function Column({
  id,
  status,
  ids,
  tasksById,
  limit,
  showHeader,
  projectCode,
  today,
  canCreate,
  canUpdate,
  onOpen,
  onQuickAdd,
}: {
  id: string
  status: TaskStatus
  ids: string[]
  tasksById: Map<string, ProjectTaskDTO>
  limit?: number
  showHeader: boolean
  projectCode: string
  today: string
  canCreate: boolean
  canUpdate: boolean
  onOpen: (id: string) => void
  onQuickAdd: (status: TaskStatus, title: string) => Promise<boolean>
}) {
  const { setNodeRef, isOver } = useDroppable({ id })
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState("")
  const exceeded = !!limit && ids.length > limit

  return (
    <div className={cn("flex w-72 shrink-0 flex-col rounded-lg bg-muted/40", exceeded && "ring-1 ring-destructive/60")}>
      {showHeader && (
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS[status] }} />
          <span className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</span>
          <span className={cn("ml-auto text-xs tabular-nums", exceeded ? "font-semibold text-destructive" : "text-muted-foreground")}>
            {ids.length}
            {limit ? ` / ${limit}` : ""}
          </span>
        </div>
      )}
      <div ref={setNodeRef} className={cn("flex min-h-24 flex-1 flex-col gap-2 p-2 transition-colors", isOver && "bg-primary/5")}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {ids.map((taskId) => {
            const task = tasksById.get(taskId)
            return task ? (
              <SortableCard key={taskId} task={task} projectCode={projectCode} today={today} onOpen={() => onOpen(taskId)} disabled={!canUpdate} />
            ) : null
          })}
        </SortableContext>
        {canCreate &&
          (adding ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                if (!title.trim()) return setAdding(false)
                if (await onQuickAdd(status, title)) setTitle("")
              }}
            >
              <Input
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={() => !title && setAdding(false)}
                onKeyDown={(e) => e.key === "Escape" && setAdding(false)}
                placeholder="Título da tarefa + Enter"
                className="h-8 bg-background"
              />
            </form>
          ) : (
            <Button variant="ghost" size="sm" className="justify-start text-muted-foreground" onClick={() => setAdding(true)}>
              <Plus className="mr-1 h-4 w-4" /> Adicionar
            </Button>
          ))}
      </div>
    </div>
  )
}

export function KanbanBoard({ projectId, projectCode, tasks, settings, statuses, swimlane, today, canCreate, canUpdate, actions }: KanbanBoardProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])

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
  const base = useMemo(() => buildColumns(tasks, lanes, statuses, swimlane), [tasks, lanes, statuses, swimlane])
  const [board, setBoard] = useState({ base, columns: base })
  if (board.base !== base) setBoard({ base, columns: base })
  const columns = board.columns
  const setColumns = (next: Record<string, string[]> | ((prev: Record<string, string[]>) => Record<string, string[]>)) =>
    setBoard((prev) => ({ ...prev, columns: typeof next === "function" ? next(prev.columns) : next }))
  const [activeId, setActiveId] = useState<string | null>(null)
  const [origin, setOrigin] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const findContainer = (id: string) => (id in columns ? id : Object.keys(columns).find((key) => columns[key].includes(id)))

  function refresh() {
    startTransition(() => router.refresh())
  }

  function onDragStart(event: DragStartEvent) {
    const id = String(event.active.id)
    setActiveId(id)
    setOrigin(findContainer(id) ?? null)
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
    setActiveId(null)
    const container = findContainer(id)
    if (!over || !container) return setColumns(buildColumns(tasks, lanes, statuses, swimlane))

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

    const task = tasksById.get(id)!
    const status = statusOf(container)
    const index = ids.indexOf(id)
    const beforeId = index > 0 ? ids[index - 1] : null
    const afterId = index < ids.length - 1 ? ids[index + 1] : null
    if (status === task.status && origin === container && activeIndex === index) return

    // WIP limit (column total across lanes, without the moved card).
    const limit = settings.wipLimits?.[status]
    if (limit && settings.wipEnforced && status !== task.status) {
      const inColumn = tasks.filter((t) => t.status === status).length
      if (inColumn >= limit) {
        toast.error(`Limite WIP de "${TASK_STATUS_LABELS[status]}" atingido (${limit}).`)
        return setColumns(buildColumns(tasks, lanes, statuses, swimlane))
      }
    }
    if (swimlane !== "none" && origin && origin.split(SEP)[0] !== container.split(SEP)[0]) {
      toast.info("Mover entre raias altera apenas o status — edite a tarefa para trocar responsável ou prioridade.")
    }

    const result = await moveProjectTask(projectId, id, { status, beforeId, afterId })
    if (!result.success) {
      toast.error(result.error || "Erro ao mover tarefa")
      setColumns(buildColumns(tasks, lanes, statuses, swimlane))
    } else if (result.warning) toast.warning(result.warning)
    refresh()
  }

  async function quickAdd(status: TaskStatus, title: string, lane: string) {
    const result = await quickCreateProjectTask(projectId, { title, status })
    if (!result.success) {
      toast.error(result.error || "Erro ao criar tarefa")
      return false
    }
    if (lane !== "all") toast.info("Tarefa criada — defina responsável/prioridade ao editá-la.")
    refresh()
    return true
  }

  const activeTask = activeId ? tasksById.get(activeId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null)
        setColumns(buildColumns(tasks, lanes, statuses, swimlane))
      }}
    >
      <div className="overflow-x-auto pb-2">
        <div className="inline-flex min-w-full flex-col gap-4">
          {swimlane !== "none" && (
            <div className="flex gap-3">
              {statuses.map((status) => {
                const count = tasks.filter((t) => t.status === status).length
                const limit = settings.wipLimits?.[status]
                return (
                  <div key={status} className="flex w-72 shrink-0 items-center gap-2 px-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLORS[status] }} />
                    <span className="text-sm font-medium">{TASK_STATUS_LABELS[status]}</span>
                    <span className={cn("ml-auto text-xs tabular-nums", limit && count > limit ? "font-semibold text-destructive" : "text-muted-foreground")}>
                      {count}
                      {limit ? ` / ${limit}` : ""}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {lanes.map((lane) => (
            <div key={lane.id} className="space-y-2">
              {swimlane !== "none" && <p className="px-1 text-sm font-semibold text-muted-foreground">{lane.label}</p>}
              <div className="flex items-stretch gap-3">
                {statuses.map((status) => {
                  const id = containerId(lane.id, status)
                  return (
                    <Column
                      key={id}
                      id={id}
                      status={status}
                      ids={columns[id] ?? []}
                      tasksById={tasksById}
                      limit={swimlane === "none" ? settings.wipLimits?.[status] : undefined}
                      showHeader={swimlane === "none"}
                      projectCode={projectCode}
                      today={today}
                      canCreate={canCreate}
                      canUpdate={canUpdate}
                      onOpen={actions.openTask}
                      onQuickAdd={(s, title) => quickAdd(s, title, lane.id)}
                    />
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
      <DragOverlay>{activeTask ? <KanbanCard task={activeTask} projectCode={projectCode} today={today} dragging /> : null}</DragOverlay>
    </DndContext>
  )
}

/** Columns shown: status filter if any, otherwise every status except Cancelada (unless asked). */
export function kanbanStatuses(statusFilter: TaskStatus[], showCancelled: boolean): TaskStatus[] {
  if (statusFilter.length) return TASK_STATUSES.filter((s) => statusFilter.includes(s))
  return TASK_STATUSES.filter((s) => s !== "CANCELLED" || showCancelled)
}
