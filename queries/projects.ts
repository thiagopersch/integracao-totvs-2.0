// Cached reads used by Server Components. Deliberately NOT a "use server" module — see
// queries/admin/clients.ts. Callers resolve the request context first and pass tenant ids in.

import { cacheTag } from "next/cache";
import { projectService, type ProjectCtx } from "@/services/project.service";
import type { CustomFieldDef } from "@/lib/custom-fields";
import type { ListParams } from "@/types/common";

export async function listProjects(
  params: ListParams & { filters?: Record<string, string | undefined> },
  ctx: ProjectCtx,
  defs: CustomFieldDef[]
) {
  "use cache";
  cacheTag("projects");
  return projectService.list(params, ctx, defs);
}

export async function getProjectById(id: string, organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag(`project-${id}`);
  return projectService.getById(id, { organizationId, allowedClientIds });
}

export async function getProjectPickerOptions(organizationId: string, allowedClientIds: string[]) {
  "use cache";
  cacheTag("projects", "clients", "contracts", "users");
  return projectService.listPickerOptions({ organizationId, allowedClientIds });
}

export async function listProjectRisks(projectId: string) {
  "use cache";
  cacheTag(`project-${projectId}`);
  return projectService.listRisks(projectId);
}
