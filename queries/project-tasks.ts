// Cached reads used by Server Components. Deliberately NOT a "use server" module — see
// queries/admin/clients.ts. Callers resolve the request context first and pass tenant ids in.

import { cacheTag } from "next/cache";
import { projectTaskService } from "@/services/project-task.service";
import { projectDashboardService } from "@/services/project-dashboard.service";
import type { ProjectCtx } from "@/services/project.service";
import type { TaskFilters } from "@/lib/project-workspace-params";
import type { CustomFieldDef } from "@/lib/custom-fields";

export async function listProjectTasks(projectId: string, filters: TaskFilters, ctx: ProjectCtx, defs: CustomFieldDef[]) {
  "use cache";
  cacheTag(`project-tasks-${projectId}`);
  return projectTaskService.list(projectId, filters, ctx, defs);
}

export async function getProjectTaskOptions(projectId: string, ctx: ProjectCtx) {
  "use cache";
  cacheTag(`project-tasks-${projectId}`, "tags");
  return projectTaskService.listOptions(projectId, ctx);
}

export async function getProjectTaskDetail(taskId: string, projectId: string, ctx: ProjectCtx) {
  "use cache";
  cacheTag(`project-tasks-${projectId}`, `project-task-${taskId}`);
  return projectTaskService.getDetail(taskId, projectId, ctx);
}

export async function getProjectDashboard(projectId: string, ctx: ProjectCtx) {
  "use cache";
  cacheTag(`project-tasks-${projectId}`, `project-${projectId}`, "contracts");
  return projectDashboardService.get(projectId, ctx);
}
