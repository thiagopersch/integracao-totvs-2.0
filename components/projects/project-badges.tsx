"use client"

import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_HEALTH_COLORS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_COLORS,
  TASK_STATUS_LABELS,
  type Priority,
  type ProjectHealth,
  type ProjectStatus,
  type TaskStatus,
} from "@/lib/projects"

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <ColorBadge label={PROJECT_STATUS_LABELS[status]} color={PROJECT_STATUS_COLORS[status]} />
}

export function TaskStatusBadge({ status }: { status: TaskStatus }) {
  return <ColorBadge label={TASK_STATUS_LABELS[status]} color={TASK_STATUS_COLORS[status]} />
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <ColorBadge label={PRIORITY_LABELS[priority]} color={PRIORITY_COLORS[priority]} />
}

/** RAG health dot + label; the tooltip lists why (computed reasons) and whether it was set manually. */
export function ProjectHealthBadge({
  health,
  auto = true,
  reasons = [],
}: {
  health: ProjectHealth | null
  auto?: boolean
  reasons?: string[]
}) {
  if (!health) return <span className="text-muted-foreground">-</span>
  const tooltip = (
    <div className="max-w-xs space-y-1 text-xs">
      <p className="font-medium">{auto ? "Saúde calculada automaticamente" : "Saúde definida manualmente"}</p>
      {reasons.length ? (
        <ul className="list-disc pl-4">
          {reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      ) : (
        <p>Sem alertas: prazo, progresso e horas dentro do planejado.</p>
      )}
    </div>
  )
  return (
    <WithTooltip label={tooltip}>
      <span className="inline-flex cursor-default items-center gap-1.5 text-sm">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PROJECT_HEALTH_COLORS[health] }} />
        {PROJECT_HEALTH_LABELS[health]}
        {!auto && <span className="text-xs text-muted-foreground">(manual)</span>}
      </span>
    </WithTooltip>
  )
}

/** Thin progress bar with percentage. */
export function ProgressCell({ value, color }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className="flex min-w-24 items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%`, ...(color ? { backgroundColor: color } : {}) }} />
      </div>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">{Math.round(pct)}%</span>
    </div>
  )
}
