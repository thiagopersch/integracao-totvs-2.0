"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Crosshair, Diamond } from "lucide-react"
import { Button } from "@/components/ui/button"
import { OptionSelect } from "@/components/projects/option-select"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { rescheduleProjectTask } from "@/actions/project-tasks"
import { useUrlParams } from "@/hooks/use-url-params"
import { buildTaskTree, rollupSummary } from "@/lib/project-tasks"
import {
  GANTT_PX_PER_DAY,
  addDays,
  barGeometry,
  computeRange,
  dateToX,
  dependencyPath,
  headerCells,
  pxToDays,
  toDateParam,
  utcDay,
} from "@/lib/gantt"
import { TASK_STATUS_COLORS, TASK_STATUS_LABELS, taskKey } from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { GanttZoom } from "@/lib/project-workspace-params"
import type { ProjectTaskDTO, WorkspaceActions } from "@/components/projects/workspace/types"

const ROW_H = 36
const LEFT_W = 320
const HEADER_H = 52
const EDGE = 7

type DragState = {
  taskId: string
  mode: "move" | "start" | "end"
  originX: number
  dx: number
}

interface GanttChartProps {
  projectId: string
  projectCode: string
  tasks: ProjectTaskDTO[]
  zoom: GanttZoom
  from?: string
  today: string
  plannedEnd?: Date | string | null
  canUpdate: boolean
  actions: WorkspaceActions
}

export function GanttChart({ projectId, projectCode, tasks, zoom, from, today, plannedEnd, canUpdate, actions }: GanttChartProps) {
  const router = useRouter()
  const { pushParams } = useUrlParams()
  const [, startTransition] = useTransition()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)

  const px = GANTT_PX_PER_DAY[zoom]
  const todayDate = utcDay(today)

  const tree = useMemo(() => buildTaskTree(tasks), [tasks])
  const visible = useMemo(() => {
    const hiddenParents = new Set<string>()
    const result: typeof tree = []
    const parentOf = new Map(tasks.map((t) => [t.id, t.parentId]))
    for (const node of tree) {
      let parent = parentOf.get(node.task.id) ?? null
      let hidden = false
      while (parent) {
        if (collapsed.has(parent) || hiddenParents.has(parent)) {
          hidden = true
          break
        }
        parent = parentOf.get(parent) ?? null
      }
      if (hidden) hiddenParents.add(node.task.id)
      else result.push(node)
    }
    return result
  }, [tree, collapsed, tasks])

  const range = useMemo(
    () => computeRange([...tasks.flatMap((t) => [t.startDate, t.dueDate]), plannedEnd ?? null] as (Date | string | null)[], todayDate, zoom, from),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, zoom, from, today, plannedEnd]
  )
  const width = range.days * px
  const header = useMemo(() => headerCells(range.start, range.days, zoom, px, todayDate), [range, zoom, px, todayDate])
  const todayX = dateToX(todayDate, range.start, px)

  // Bars: own dates, or the children's roll-up for parents without dates.
  const bars = useMemo(() => {
    const map = new Map<string, { x: number; width: number; summary: boolean } | null>()
    for (const { task, hasChildren } of tree) {
      const own = barGeometry(task, range.start, px)
      if (own) map.set(task.id, { x: own.x, width: own.width, summary: false })
      else if (hasChildren) {
        const span = rollupSummary(tasks, task.id)
        const g = span.start && span.end ? barGeometry({ startDate: span.start, dueDate: span.end }, range.start, px) : null
        map.set(task.id, g ? { x: g.x, width: g.width, summary: true } : null)
      } else map.set(task.id, null)
    }
    return map
  }, [tree, tasks, range.start, px])

  const rowIndex = useMemo(() => new Map(visible.map((n, i) => [n.task.id, i])), [visible])

  const arrows = useMemo(() => {
    const paths: { key: string; d: string }[] = []
    for (const { task } of visible) {
      for (const dep of task.predecessors) {
        const fromRow = rowIndex.get(dep.predecessorId)
        const toRow = rowIndex.get(task.id)
        const fromBar = bars.get(dep.predecessorId)
        const toBar = bars.get(task.id)
        if (fromRow === undefined || toRow === undefined || !fromBar || !toBar) continue
        paths.push({ key: dep.id, d: dependencyPath({ x: fromBar.x, width: fromBar.width, row: fromRow }, { x: toBar.x, row: toRow }, ROW_H) })
      }
    }
    return paths
  }, [visible, rowIndex, bars])

  function scrollToToday() {
    const el = scrollRef.current
    if (el) el.scrollTo({ left: Math.max(0, todayX - (el.clientWidth - LEFT_W) / 3), behavior: "smooth" })
  }

  useEffect(() => {
    scrollToToday()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom])

  function startDrag(e: React.PointerEvent, task: ProjectTaskDTO, bar: { x: number; width: number }) {
    if (!canUpdate || e.button !== 0) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    const offset = e.clientX - rect.left
    const mode: DragState["mode"] = task.isMilestone ? "move" : offset < EDGE ? "start" : offset > rect.width - EDGE ? "end" : "move"
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    const state = { taskId: task.id, mode, originX: e.clientX, dx: 0 }
    dragRef.current = state
    setDrag(state)
    e.stopPropagation()
    void bar
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return
    const next = { ...dragRef.current, dx: e.clientX - dragRef.current.originX }
    dragRef.current = next
    setDrag(next)
  }

  async function onPointerUp(task: ProjectTaskDTO) {
    const state = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!state) return
    const days = pxToDays(state.dx, px)
    if (days === 0) {
      if (Math.abs(state.dx) < 3) actions.openTask(task.id)
      return
    }
    const start = task.startDate ? utcDay(task.startDate) : task.dueDate ? utcDay(task.dueDate) : null
    const end = task.dueDate ? utcDay(task.dueDate) : start
    if (!start || !end) return
    let nextStart = start
    let nextEnd = end
    if (state.mode === "move") {
      nextStart = addDays(start, days)
      nextEnd = addDays(end, days)
    } else if (state.mode === "start") {
      nextStart = addDays(start, days)
      if (nextStart > end) nextStart = end
    } else {
      nextEnd = addDays(end, days)
      if (nextEnd < start) nextEnd = start
    }
    const payload = {
      startDate: task.startDate || state.mode !== "move" ? toDateParam(nextStart) : undefined,
      dueDate: task.dueDate || state.mode !== "move" ? toDateParam(nextEnd) : undefined,
    }
    const result = await rescheduleProjectTask(projectId, task.id, payload)
    if (result.success) {
      toast.success(`${taskKey(projectCode, task.number)}: ${formatDateOnly(nextStart)} → ${formatDateOnly(nextEnd)}`)
      startTransition(() => router.refresh())
    } else toast.error(result.error || "Erro ao reagendar")
  }

  function previewBar(task: ProjectTaskDTO, bar: { x: number; width: number }) {
    if (!drag || drag.taskId !== task.id) return bar
    const snapped = pxToDays(drag.dx, px) * px
    if (drag.mode === "move") return { x: bar.x + snapped, width: bar.width }
    if (drag.mode === "start") return { x: Math.min(bar.x + snapped, bar.x + bar.width - px), width: Math.max(px, bar.width - snapped) }
    return { x: bar.x, width: Math.max(px, bar.width + snapped) }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="w-36">
          <OptionSelect
            options={[
              { value: "day", label: "Dias" },
              { value: "week", label: "Semanas" },
              { value: "month", label: "Meses" },
            ]}
            value={zoom}
            onChange={(v) => pushParams({ zoom: v || "week", from: undefined })}
          />
        </div>
        <Button variant="outline" size="sm" onClick={scrollToToday}>
          <Crosshair className="mr-1.5 h-4 w-4" /> Hoje
        </Button>
        <p className="text-xs text-muted-foreground">
          {canUpdate ? "Arraste a barra para mover; puxe as bordas para alterar início/prazo. Clique para abrir." : "Clique numa barra para abrir a tarefa."}
        </p>
      </div>

      <div ref={scrollRef} className="relative max-h-[70vh] overflow-auto rounded-md border" onPointerMove={onPointerMove}>
        <div className="relative" style={{ width: LEFT_W + width, minHeight: HEADER_H + visible.length * ROW_H }}>
          {/* Header */}
          <div className="sticky top-0 z-30 flex border-b bg-background" style={{ height: HEADER_H }}>
            <div className="sticky left-0 z-10 flex shrink-0 items-end border-r bg-background px-3 pb-1.5 text-xs font-medium text-muted-foreground" style={{ width: LEFT_W }}>
              Tarefa
            </div>
            <div className="relative" style={{ width }}>
              {header.top.map((c) => (
                <div key={c.key} className="absolute top-0 h-6 truncate border-l px-1.5 text-xs font-medium capitalize leading-6" style={{ left: c.x, width: c.width }}>
                  {c.label}
                </div>
              ))}
              {header.bottom.map((c) => (
                <div
                  key={c.key}
                  className={cn(
                    "absolute top-6 h-[26px] border-l text-center text-[11px] leading-[26px] text-muted-foreground",
                    c.weekend && "bg-muted/60",
                    c.today && "bg-primary/15 font-semibold text-primary"
                  )}
                  style={{ left: c.x, width: c.width }}
                >
                  {c.label}
                </div>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="relative">
            {/* Weekend shading (day zoom) + today line + planned end */}
            <div className="pointer-events-none absolute inset-y-0" style={{ left: LEFT_W, width }}>
              {zoom === "day" &&
                header.bottom
                  .filter((c) => c.weekend)
                  .map((c) => <div key={c.key} className="absolute inset-y-0 bg-muted/40" style={{ left: c.x, width: c.width }} />)}
              {todayX >= 0 && todayX <= width && <div className="absolute inset-y-0 z-10 w-px bg-primary" style={{ left: todayX + px / 2 }} />}
              {plannedEnd && (
                <WithTooltip label={`Término previsto: ${formatDateOnly(plannedEnd)}`}>
                  <div className="absolute inset-y-0 w-px border-l border-dashed border-destructive/70" style={{ left: dateToX(plannedEnd, range.start, px) + px }} />
                </WithTooltip>
              )}
            </div>

            {visible.map(({ task, depth, hasChildren }) => {
              const bar = bars.get(task.id)
              const shown = bar ? previewBar(task, bar) : null
              const color = TASK_STATUS_COLORS[task.status]
              return (
                <div key={task.id} className="group flex border-b hover:bg-muted/30" style={{ height: ROW_H }}>
                  <div
                    className="sticky left-0 z-20 flex shrink-0 items-center gap-1 border-r bg-background px-2 text-sm group-hover:bg-muted"
                    style={{ width: LEFT_W, paddingLeft: 8 + depth * 16 }}
                  >
                    {hasChildren ? (
                      <button
                        type="button"
                        className="rounded p-0.5 hover:bg-muted"
                        onClick={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev)
                            if (next.has(task.id)) next.delete(task.id)
                            else next.add(task.id)
                            return next
                          })
                        }
                        aria-label={collapsed.has(task.id) ? "Expandir" : "Recolher"}
                      >
                        {collapsed.has(task.id) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    ) : (
                      <span className="w-4.5" />
                    )}
                    <button type="button" className="flex min-w-0 flex-1 items-center gap-1.5 text-left" onClick={() => actions.openTask(task.id)}>
                      <span className="font-mono text-[11px] text-muted-foreground">{task.number}</span>
                      <span className={cn("truncate", hasChildren && "font-semibold")}>{task.title}</span>
                    </button>
                  </div>
                  <div className="relative" style={{ width }}>
                    {!shown ? (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground opacity-0 group-hover:opacity-100" style={{ left: todayX + 8 }}>
                        sem datas — edite a tarefa para planejar
                      </span>
                    ) : task.isMilestone ? (
                      <WithTooltip label={`${task.title} · ${task.dueDate ? formatDateOnly(task.dueDate) : ""}`}>
                        <div
                          className={cn("absolute top-1/2 z-10 -translate-y-1/2", canUpdate ? "cursor-grab" : "cursor-pointer")}
                          style={{ left: shown.x + shown.width / 2 - 8 }}
                          onPointerDown={(e) => startDrag(e, task, shown)}
                          onPointerUp={() => onPointerUp(task)}
                        >
                          <Diamond className="h-4 w-4" style={{ color, fill: color }} />
                        </div>
                      </WithTooltip>
                    ) : bar?.summary ? (
                      <div className="absolute top-1/2 z-10 h-2 -translate-y-1/2 rounded-sm bg-foreground/70" style={{ left: shown.x, width: shown.width }}>
                        <span className="absolute -bottom-1 left-0 h-2 w-1 bg-foreground/70" />
                        <span className="absolute -bottom-1 right-0 h-2 w-1 bg-foreground/70" />
                      </div>
                    ) : (
                      <WithTooltip
                        label={
                          <span>
                            {task.title}
                            <br />
                            {task.startDate ? formatDateOnly(task.startDate) : "?"} → {task.dueDate ? formatDateOnly(task.dueDate) : "?"} · {TASK_STATUS_LABELS[task.status]} · {task.progress}%
                          </span>
                        }
                      >
                        <div
                          className={cn(
                            "absolute top-1/2 z-10 h-5 -translate-y-1/2 overflow-hidden rounded select-none",
                            canUpdate ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
                            drag?.taskId === task.id && "ring-2 ring-primary/50"
                          )}
                          style={{ left: shown.x, width: shown.width, backgroundColor: `${color}55`, border: `1px solid ${color}` }}
                          onPointerDown={(e) => startDrag(e, task, shown)}
                          onPointerUp={() => onPointerUp(task)}
                        >
                          <div className="h-full" style={{ width: `${task.status === "DONE" ? 100 : task.progress}%`, backgroundColor: color }} />
                          {zoom !== "month" && shown.width > 60 && (
                            <span className="pointer-events-none absolute inset-0 truncate px-1.5 text-[11px] font-medium leading-5">{task.title}</span>
                          )}
                        </div>
                      </WithTooltip>
                    )}
                  </div>
                </div>
              )
            })}

            {/* Dependency arrows */}
            <svg className="pointer-events-none absolute top-0 z-0" style={{ left: LEFT_W, width, height: visible.length * ROW_H }}>
              <defs>
                <marker id="gantt-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 8 4 L 0 8 z" className="fill-muted-foreground" />
                </marker>
              </defs>
              {arrows.map((a) => (
                <path key={a.key} d={a.d} fill="none" strokeWidth={1.25} className="stroke-muted-foreground" markerEnd="url(#gantt-arrow)" />
              ))}
            </svg>

            {visible.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhuma tarefa para exibir no cronograma.</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
