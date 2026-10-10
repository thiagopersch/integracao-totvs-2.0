"use client"

import { Progress, ProgressLabel, ProgressValue } from "@/components/ui/progress"
import { describeStep, isFinished, progressPercent, type DataserverLoadProgress } from "@/lib/tbc-checklist-progress"

/**
 * How far the processo's checklist load is: overall bar (each Data Server weighing the same), what
 * is running right now, and how many Data Servers are already on screen.
 */
export function ChecklistLoadProgress({ items }: { items: DataserverLoadProgress[] }) {
  const percent = progressPercent(items)
  const finished = items.filter(isFinished).length
  // The busiest step first: fetching records, then querying the view, then waiting.
  const current =
    items.find((p) => p.phase === "records") ?? items.find((p) => p.phase === "view") ?? items.find((p) => p.phase === "waiting")

  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <Progress value={percent} className="gap-1.5">
        <ProgressLabel className="min-w-0 truncate text-xs font-normal">
          {current ? (
            <>
              <span className="font-medium">{current.name}</span> — {describeStep(current)}
            </>
          ) : (
            "Checklist carregado"
          )}
        </ProgressLabel>
        <ProgressValue className="text-xs" />
      </Progress>
      <p className="pt-1.5 text-xs text-muted-foreground">
        {finished} de {items.length} Data {items.length === 1 ? "Server carregado" : "Servers carregados"}
      </p>
    </div>
  )
}
