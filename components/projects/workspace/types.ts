import type { ProjectRow } from "@/services/project.service"
import type { ProjectTaskDTO, projectTaskService } from "@/services/project-task.service"
import type { ProjectDashboardData } from "@/services/project-dashboard.service"
import type { projectService } from "@/services/project.service"

export type { ProjectRow, ProjectTaskDTO, ProjectDashboardData }

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof projectTaskService.getDetail>>>
export type TaskOptions = Awaited<ReturnType<typeof projectTaskService.listOptions>>
export type ProjectRisk = Awaited<ReturnType<typeof projectService.listRisks>>[number]

export type TeamMember = { id: string; name: string; image?: string | null }

/** Callbacks every view uses to drive the workspace (open the sheet, create, log hours). */
export type WorkspaceActions = {
  openTask: (taskId: string) => void
  newTask: (defaults?: NewTaskDefaults) => void
  logTime: (taskId: string) => void
  refresh: () => void
}

export type NewTaskDefaults = {
  status?: ProjectTaskDTO["status"]
  parentId?: string
  startDate?: string
  dueDate?: string
  assigneeId?: string
}
