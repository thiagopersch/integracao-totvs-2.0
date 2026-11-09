import type { StageRef } from "@/lib/projects"

/** Columns shown: the stage filter if any, otherwise every stage except cancelled ones (unless asked). */
export function kanbanStages(stages: StageRef[], stageFilter: string[], showCancelled: boolean): StageRef[] {
  if (stageFilter.length) return stages.filter((s) => stageFilter.includes(s.id))
  return stages.filter((s) => s.category !== "CANCELLED" || showCancelled)
}
