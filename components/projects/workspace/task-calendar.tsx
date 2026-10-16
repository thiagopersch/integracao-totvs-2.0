"use client"

import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DndContext, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { ChevronLeft, ChevronRight, Diamond, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { OptionSelect } from "@/components/projects/option-select"
import { rescheduleProjectTask } from "@/actions/project-tasks"
import { useUrlParams } from "@/hooks/use-url-params"
import { addDays, diffDays, toDateParam, utcDay } from "@/lib/gantt"
import { CLOSED_TASK_STATUSES, byPriority, type StageRef } from "@/lib/projects"
import { cn } from "@/lib/utils"
import type { ProjectTaskDTO, WorkspaceActions } from "@/components/projects/workspace/types"

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"]
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"]
const MAX_CHIPS = 3

interface TaskCalendarProps {
  projectId: string
  projectCode: string
  tasks: ProjectTaskDTO[]
  stages: StageRef[]
  month?: string
  by: "due" | "start"
  today: string
  canCreate: boolean
  canUpdate: boolean
  actions: WorkspaceActions
}

function Chip({ task, color, today, by, onOpen, draggable }: { task: ProjectTaskDTO; color: string; today: string; by: "due" | "start"; onOpen: () => void; draggable: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: !draggable })
  const due = task.dueDate ? toDateParam(utcDay(task.dueDate)) : null
  const overdue = by === "due" && !!due && due < today && !CLOSED_TASK_STATUSES.includes(task.status)
  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen()
      }}
      className={cn(
        "flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] leading-4 touch-none",
        isDragging && "opacity-40",
        task.status === "DONE" && "line-through opacity-70",
        overdue && "ring-1 ring-destructive"
      )}
      style={{ backgroundColor: `${color}26`, borderLeft: `3px solid ${color}` }}
      {...attributes}
      {...listeners}
    >
      {task.isMilestone && <Diamond className="h-2.5 w-2.5 shrink-0 fill-amber-500 text-amber-500" />}
      <span className="truncate">{task.title}</span>
    </button>
  )
}

function DayCell({
  day,
  inMonth,
  isToday,
  items,
  stageColors,
  today,
  by,
  canCreate,
  canUpdate,
  actions,
}: {
  day: Date
  inMonth: boolean
  isToday: boolean
  items: ProjectTaskDTO[]
  stageColors: Record<string, string>
  today: string
  by: "due" | "start"
  canCreate: boolean
  canUpdate: boolean
  actions: WorkspaceActions
}) {
  const key = toDateParam(day)
  const { setNodeRef, isOver } = useDroppable({ id: key })
  const extra = items.length - MAX_CHIPS
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "group relative flex min-h-28 flex-col gap-1 border-b border-r p-1.5",
        !inMonth && "bg-muted/30 text-muted-foreground",
        isOver && "bg-primary/10"
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn("flex h-6 w-6 items-center justify-center rounded-full text-xs", isToday && "bg-primary font-semibold text-primary-foreground")}>
          {day.getUTCDate()}
        </span>
        {canCreate && (
          <button
            type="button"
            className="rounded p-0.5 opacity-0 hover:bg-muted group-hover:opacity-100"
            onClick={() => actions.newTask(by === "due" ? { dueDate: key } : { startDate: key })}
            aria-label="Nova tarefa neste dia"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {items.slice(0, MAX_CHIPS).map((task) => (
        <Chip key={task.id} task={task} color={stageColors[task.stageId ?? ""] ?? "#6b7280"} today={today} by={by} onOpen={() => actions.openTask(task.id)} draggable={canUpdate} />
      ))}
      {extra > 0 && (
        <Popover>
          <PopoverTrigger render={<button type="button" className="text-left text-[11px] font-medium text-muted-foreground hover:underline" />}>
            +{extra} tarefa(s)
          </PopoverTrigger>
          <PopoverContent className="w-64 space-y-1 p-2">
            {items.map((task) => (
              <Chip key={task.id} task={task} color={stageColors[task.stageId ?? ""] ?? "#6b7280"} today={today} by={by} onOpen={() => actions.openTask(task.id)} draggable={false} />
            ))}
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

export function TaskCalendar({ projectId, tasks, stages, month, by, today, canCreate, canUpdate, actions }: TaskCalendarProps) {
  const stageColors = useMemo(() => Object.fromEntries(stages.map((s) => [s.id, s.color])), [stages])
  const router = useRouter()
  const { pushParams } = useUrlParams()
  const [, startTransition] = useTransition()
  const [optimistic, setOptimistic] = useState<Record<string, string>>({})
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const todayDate = utcDay(today)
  const [year, monthIndex] = (month ?? today.slice(0, 7)).split("-").map(Number)
  const first = new Date(Date.UTC(year, monthIndex - 1, 1))
  const gridStart = addDays(first, -((first.getUTCDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))

  const byDay = useMemo(() => {
    const map = new Map<string, ProjectTaskDTO[]>()
    for (const task of tasks) {
      const value = optimistic[task.id] ?? (by === "due" ? task.dueDate : task.startDate)
      if (!value) continue
      const key = toDateParam(utcDay(value))
      map.set(key, [...(map.get(key) ?? []), task])
    }
    for (const items of map.values()) items.sort((a, b) => byPriority(a, b) || a.number - b.number)
    return map
  }, [tasks, by, optimistic])
  const undated = tasks.filter((t) => !(by === "due" ? t.dueDate : t.startDate)).length

  function shiftMonth(delta: number) {
    const d = new Date(Date.UTC(year, monthIndex - 1 + delta, 1))
    pushParams({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` })
  }

  async function onDragEnd(event: DragEndEvent) {
    if (!event.over) return
    const task = tasks.find((t) => t.id === event.active.id)
    if (!task) return
    const target = String(event.over.id)
    const current = by === "due" ? task.dueDate : task.startDate
    if (!current || toDateParam(utcDay(current)) === target) return
    const delta = diffDays(utcDay(target), utcDay(current))
    // Keep the task's duration: shift the other date by the same delta.
    const payload =
      by === "due"
        ? { dueDate: target, startDate: task.startDate ? toDateParam(addDays(utcDay(task.startDate), delta)) : undefined }
        : { startDate: target, dueDate: task.dueDate ? toDateParam(addDays(utcDay(task.dueDate), delta)) : undefined }
    setOptimistic((prev) => ({ ...prev, [task.id]: target }))
    const result = await rescheduleProjectTask(projectId, task.id, payload)
    if (!result.success) toast.error(result.error || "Erro ao reagendar")
    startTransition(() => {
      router.refresh()
    })
    setOptimistic((prev) => {
      const next = { ...prev }
      delete next[task.id]
      return next
    })
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(-1)} aria-label="Mês anterior">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shiftMonth(1)} aria-label="Próximo mês">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h3 className="min-w-40 text-lg font-semibold">
          {MONTHS[monthIndex - 1]} {year}
        </h3>
        <Button variant="outline" size="sm" onClick={() => pushParams({ month: undefined })}>
          Hoje
        </Button>
        <div className="ml-auto w-40">
          <OptionSelect
            options={[
              { value: "due", label: "Por prazo" },
              { value: "start", label: "Por início" },
            ]}
            value={by}
            onChange={(v) => pushParams({ by: v === "start" ? "start" : undefined })}
          />
        </div>
      </div>
      <DndContext id={`calendar-${projectId}`} sensors={sensors} onDragEnd={onDragEnd}>
        <div className="overflow-x-auto rounded-md border">
          <div className="grid min-w-[720px] grid-cols-7 border-l">
            {WEEKDAYS.map((d) => (
              <div key={d} className="border-b border-r bg-muted/40 px-2 py-1.5 text-xs font-medium text-muted-foreground">
                {d}
              </div>
            ))}
            {days.map((day) => (
              <DayCell
                key={day.toISOString()}
                day={day}
                inMonth={day.getUTCMonth() === monthIndex - 1}
                isToday={day.getTime() === todayDate.getTime()}
                items={byDay.get(toDateParam(day)) ?? []}
                stageColors={stageColors}
                today={today}
                by={by}
                canCreate={canCreate}
                canUpdate={canUpdate}
                actions={actions}
              />
            ))}
          </div>
        </div>
      </DndContext>
      {undated > 0 && (
        <p className="text-xs text-muted-foreground">
          {undated} tarefa(s) sem data de {by === "due" ? "prazo" : "início"} não aparecem no calendário.
        </p>
      )}
    </div>
  )
}
