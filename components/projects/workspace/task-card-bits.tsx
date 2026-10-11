"use client"

import { CalendarClock, CheckSquare, Diamond, GitBranch, MessageSquare } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { PRIORITY_COLORS, PRIORITY_LABELS, CLOSED_TASK_STATUSES, formatHours } from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { ProjectTaskDTO } from "@/components/projects/workspace/types"

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("")
}

export function UserAvatar({ name, image, className }: { name: string; image?: string | null; className?: string }) {
  return (
    <WithTooltip label={name}>
      <Avatar className={cn("h-6 w-6 text-[10px]", className)}>
        {image && <AvatarImage src={image} alt={name} />}
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
    </WithTooltip>
  )
}

/** "Atrasada" / "Vence hoje" / date, tinted by urgency. `today` is yyyy-MM-dd (server clock). */
export function DueDateLabel({ task, today, className }: { task: Pick<ProjectTaskDTO, "dueDate" | "status">; today: string; className?: string }) {
  if (!task.dueDate) return null
  const due = new Date(task.dueDate).toISOString().slice(0, 10)
  const closed = CLOSED_TASK_STATUSES.includes(task.status)
  const overdue = !closed && due < today
  const isToday = !closed && due === today
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs",
        overdue ? "font-medium text-destructive" : isToday ? "font-medium text-amber-600 dark:text-amber-400" : "text-muted-foreground",
        className
      )}
    >
      <CalendarClock className="h-3 w-3" />
      {overdue ? `Atrasada · ${formatDateOnly(task.dueDate)}` : isToday ? "Vence hoje" : formatDateOnly(task.dueDate)}
    </span>
  )
}

export function PriorityDot({ priority }: { priority: ProjectTaskDTO["priority"] }) {
  return (
    <WithTooltip label={`Prioridade ${PRIORITY_LABELS[priority]}`}>
      <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[priority] }} />
    </WithTooltip>
  )
}

/** Compact counters shown on cards: subtasks, checklist, comments, hours. */
export function TaskMeta({ task }: { task: ProjectTaskDTO }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs text-muted-foreground">
      {task.isMilestone && <Diamond className="h-3 w-3 fill-amber-500 text-amber-500" />}
      {task.childCount > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <GitBranch className="h-3 w-3" /> {task.childCount}
        </span>
      )}
      {task.checklistTotal > 0 && (
        <span className={cn("inline-flex items-center gap-0.5", task.checklistDone === task.checklistTotal && "text-emerald-600")}>
          <CheckSquare className="h-3 w-3" /> {task.checklistDone}/{task.checklistTotal}
        </span>
      )}
      {task.commentCount > 0 && (
        <span className="inline-flex items-center gap-0.5">
          <MessageSquare className="h-3 w-3" /> {task.commentCount}
        </span>
      )}
      {(task.loggedMinutes > 0 || task.estimateHours) && (
        <span className="tabular-nums">
          {formatHours(task.loggedMinutes, "minutes")}
          {task.estimateHours ? `/${formatHours(task.estimateHours)}` : ""}
        </span>
      )}
    </div>
  )
}
