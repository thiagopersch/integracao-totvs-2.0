import { Suspense } from "react"
import { notFound } from "next/navigation"
import { getProjectById, getProjectPickerOptions, listProjectRisks } from "@/queries/projects"
import { getProjectDashboard, getProjectTaskDetail, getProjectTaskOptions, listProjectTasks } from "@/queries/project-tasks"
import { listActiveCustomFieldDefinitions } from "@/queries/custom-fields"
import { ProjectWorkspace } from "@/components/projects/workspace/project-workspace"
import { TableSkeleton } from "@/components/shared/table-skeleton"
import { getRequestContext } from "@/lib/tenant"
import { getTodayDateOnly } from "@/lib/export-period"
import { parseWorkspaceParams } from "@/lib/project-workspace-params"

type PageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default function ProjectWorkspacePage({ params, searchParams }: PageProps) {
  return (
    <div className="p-4 md:p-6">
      <Suspense fallback={<TableSkeleton />}>
        <ProjectWorkspaceContent params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  )
}

async function ProjectWorkspaceContent({ params, searchParams }: PageProps) {
  const [{ id }, rawParams] = await Promise.all([params, searchParams])
  const { organizationId, userId, allowedClientIds } = await getRequestContext()
  const ctx = { organizationId, userId, allowedClientIds }

  const project = await getProjectById(id, organizationId, allowedClientIds)
  if (!project) notFound()

  const workspace = parseWorkspaceParams(rawParams)
  const view = workspace.view
  // Only the active view's data is fetched; the overview reuses the dashboard numbers + tasks.
  const needsTasks = view !== "dashboard"
  const needsDashboard = view === "dashboard" || view === "overview"

  const [taskDefs, projectDefs, pickerOptions, taskOptions] = await Promise.all([
    listActiveCustomFieldDefinitions(organizationId, "TASK"),
    listActiveCustomFieldDefinitions(organizationId, "PROJECT"),
    getProjectPickerOptions(organizationId, allowedClientIds),
    getProjectTaskOptions(id, ctx),
  ])

  const [tasks, dashboard, risks, taskDetail] = await Promise.all([
    needsTasks
      ? listProjectTasks(id, view === "overview" ? { ...workspace.filters, status: [], showCancelled: false } : workspace.filters, ctx, taskDefs)
      : Promise.resolve(null),
    needsDashboard ? getProjectDashboard(id, ctx) : Promise.resolve(null),
    view === "overview" ? listProjectRisks(id) : Promise.resolve([]),
    workspace.task ? getProjectTaskDetail(workspace.task, id, ctx) : Promise.resolve(null),
  ])

  return (
    <ProjectWorkspace
      project={project}
      params={workspace}
      today={getTodayDateOnly().toISOString().slice(0, 10)}
      currentUserId={userId}
      tasks={tasks}
      taskOptions={taskOptions}
      taskDetail={taskDetail}
      dashboard={dashboard}
      risks={risks}
      taskDefs={taskDefs}
      projectDefs={projectDefs}
      pickerOptions={pickerOptions}
    />
  )
}
