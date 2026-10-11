"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, CalendarDays, ChartGantt, Clock, Gauge, KanbanSquare, LayoutDashboard, List, Pencil, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, ScrollableTabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { PendingRegion } from "@/components/shared/pending-region"
import { ColorBadge } from "@/components/shared/color-badge"
import { PriorityBadge, ProgressCell, ProjectHealthBadge, ProjectStatusBadge } from "@/components/projects/project-badges"
import { ProjectFormDialog, type ProjectPickerOptions } from "@/components/projects/project-form-dialog"
import { WorkspaceFilters } from "@/components/projects/workspace/workspace-filters"
import { KanbanBoard, kanbanStatuses } from "@/components/projects/workspace/kanban-board"
import { TaskListView } from "@/components/projects/workspace/task-list-view"
import { GanttChart } from "@/components/projects/workspace/gantt-chart"
import { TaskCalendar } from "@/components/projects/workspace/task-calendar"
import { ProjectDashboard } from "@/components/projects/workspace/project-dashboard"
import { ProjectOverview } from "@/components/projects/workspace/project-overview"
import { TaskSheet } from "@/components/projects/workspace/task-sheet"
import { TaskFormDialog } from "@/components/projects/workspace/task-form-dialog"
import { TimeEntryDialog, type EditableTimeEntry } from "@/components/projects/workspace/time-entry-dialog"
import { setProjectLifecycleStatus } from "@/actions/projects"
import { useUrlParams } from "@/hooks/use-url-params"
import { useHasPermission } from "@/hooks/use-permissions"
import { WORKSPACE_VIEW_LABELS, type WorkspaceParams, type WorkspaceView } from "@/lib/project-workspace-params"
import { PROJECT_STATUSES, PROJECT_STATUS_COLORS, PROJECT_STATUS_LABELS, formatHours, type ProjectStatus } from "@/lib/projects"
import type { CustomFieldDef } from "@/lib/custom-fields"
import type {
  NewTaskDefaults,
  ProjectDashboardData,
  ProjectRisk,
  ProjectRow,
  ProjectTaskDTO,
  TaskDetail,
  TaskOptions,
  TeamMember,
  WorkspaceActions,
} from "@/components/projects/workspace/types"

const VIEW_ICONS: Record<WorkspaceView, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  kanban: KanbanSquare,
  list: List,
  gantt: ChartGantt,
  calendar: CalendarDays,
  dashboard: Gauge,
}

interface ProjectWorkspaceProps {
  project: ProjectRow
  params: WorkspaceParams
  today: string
  currentUserId: string
  tasks: ProjectTaskDTO[] | null
  taskOptions: TaskOptions
  taskDetail: TaskDetail | null
  dashboard: ProjectDashboardData | null
  risks: ProjectRisk[]
  taskDefs: CustomFieldDef[]
  projectDefs: CustomFieldDef[]
  pickerOptions: ProjectPickerOptions
}

export function ProjectWorkspace({
  project,
  params,
  today,
  currentUserId,
  tasks,
  taskOptions,
  taskDetail,
  dashboard,
  risks,
  taskDefs,
  projectDefs,
  pickerOptions,
}: ProjectWorkspaceProps) {
  // Two navigators: view/filter changes dim the body; opening a task only dims the sheet.
  const nav = useUrlParams()
  const sheetNav = useUrlParams()
  const can = {
    createTask: useHasPermission("project_tasks", "create"),
    updateTask: useHasPermission("project_tasks", "update"),
    deleteTask: useHasPermission("project_tasks", "delete"),
    logTime: useHasPermission("project_time_entries", "create"),
    updateProject: useHasPermission("projects", "update"),
  }

  const [editProject, setEditProject] = useState(false)
  const [taskForm, setTaskForm] = useState<{ open: boolean; edit: boolean; defaults?: NewTaskDefaults }>({ open: false, edit: false })
  const [timeEntry, setTimeEntry] = useState<{ open: boolean; taskId?: string; entry?: EditableTimeEntry | null }>({ open: false })

  const team: TeamMember[] = useMemo(() => project.members.map((m) => ({ id: m.userId, name: m.name, image: m.image })), [project.members])
  const usersById = useMemo(() => Object.fromEntries(pickerOptions.users.map((u) => [u.id, u.name])), [pickerOptions.users])

  const actions: WorkspaceActions = {
    openTask: (taskId) => sheetNav.pushParams({ task: taskId }),
    newTask: (defaults) => setTaskForm({ open: true, edit: false, defaults }),
    logTime: (taskId) => setTimeEntry({ open: true, taskId, entry: null }),
    refresh: () => nav.refresh(),
  }

  async function changeStatus(status: ProjectStatus) {
    const result = await setProjectLifecycleStatus(project.id, { status })
    if (result.success) {
      toast.success(`Status: ${PROJECT_STATUS_LABELS[status]}`)
      nav.refresh()
    } else toast.error(result.error || "Erro ao alterar status")
  }

  const sheetTask = taskDetail && taskDetail.id === params.task ? taskDetail : null
  const showFilters = !["overview", "dashboard"].includes(params.view)

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <Link href="/projetos/gestao" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Projetos
        </Link>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: project.color }} />
              <span className="font-mono text-sm text-muted-foreground">{project.code}</span>
              <h1 className="truncate text-2xl font-bold tracking-tight">{project.name}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {can.updateProject ? (
                <DropdownMenu>
                  <DropdownMenuTrigger className="cursor-pointer rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <ProjectStatusBadge status={project.status} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {PROJECT_STATUSES.filter((s) => s !== project.status).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => changeStatus(s)}>
                        <ColorBadge label={PROJECT_STATUS_LABELS[s]} color={PROJECT_STATUS_COLORS[s]} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <ProjectStatusBadge status={project.status} />
              )}
              <ProjectHealthBadge health={project.health} auto={project.healthAuto} reasons={project.healthReasons} />
              <PriorityBadge priority={project.priority} />
              {project.client && <ColorBadge label={project.client.name} color={project.client.color} solid />}
              {project.manager && <span className="text-sm text-muted-foreground">Gerente: {project.manager.name}</span>}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:items-end">
            <div className="w-64">
              <ProgressCell value={project.progress} color={project.color} />
              <p className="mt-0.5 text-xs text-muted-foreground">
                {project.doneCount}/{project.taskCount} tarefas · {formatHours(project.loggedHours)}
                {project.budgetHours ? ` de ${formatHours(project.budgetHours)}` : ""} apontadas
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {can.logTime && (
                <Button variant="outline" size="sm" onClick={() => setTimeEntry({ open: true, entry: null })}>
                  <Clock className="mr-1.5 h-4 w-4" /> Apontar horas
                </Button>
              )}
              {can.updateProject && (
                <Button variant="outline" size="sm" onClick={() => setEditProject(true)}>
                  <Pencil className="mr-1.5 h-4 w-4" /> Editar projeto
                </Button>
              )}
              {can.createTask && (
                <Button size="sm" onClick={() => actions.newTask()}>
                  <Plus className="mr-1.5 h-4 w-4" /> Nova tarefa
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Tabs value={params.view} onValueChange={(v) => nav.pushParams({ view: v === "kanban" ? undefined : (v as string), page: undefined, sort: undefined })}>
        <ScrollableTabsList>
          {(Object.keys(WORKSPACE_VIEW_LABELS) as WorkspaceView[]).map((view) => {
            const Icon = VIEW_ICONS[view]
            return (
              <TabsTrigger key={view} value={view}>
                <Icon className="mr-1.5 h-4 w-4" /> {WORKSPACE_VIEW_LABELS[view]}
              </TabsTrigger>
            )
          })}
        </ScrollableTabsList>
      </Tabs>

      {showFilters && (
        <WorkspaceFilters
          view={params.view}
          filters={params.filters}
          swimlane={params.kanban.swimlane}
          team={team}
          tags={taskOptions.tags}
          defs={taskDefs}
          usersById={usersById}
          pushParams={nav.pushParams}
        />
      )}

      <PendingRegion pending={nav.isPending}>
        {params.view === "kanban" && tasks && (
          <KanbanBoard
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            settings={project.settings}
            statuses={kanbanStatuses(params.filters.status, params.filters.showCancelled)}
            swimlane={params.kanban.swimlane}
            today={today}
            canCreate={can.createTask}
            canUpdate={can.updateTask}
            actions={actions}
          />
        )}
        {params.view === "list" && tasks && (
          <TaskListView
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            params={params.list}
            defs={taskDefs}
            usersById={usersById}
            today={today}
            can={{ create: can.createTask, update: can.updateTask, delete: can.deleteTask, logTime: can.logTime }}
            actions={actions}
          />
        )}
        {params.view === "gantt" && tasks && (
          <GanttChart
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            zoom={params.gantt.zoom}
            from={params.gantt.from}
            today={today}
            plannedEnd={project.plannedEndDate}
            canUpdate={can.updateTask}
            actions={actions}
          />
        )}
        {params.view === "calendar" && tasks && (
          <TaskCalendar
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            month={params.calendar.month}
            by={params.calendar.by}
            today={today}
            canCreate={can.createTask}
            canUpdate={can.updateTask}
            actions={actions}
          />
        )}
        {params.view === "dashboard" && dashboard && <ProjectDashboard data={dashboard} projectCode={project.code} actions={actions} />}
        {params.view === "overview" && dashboard && tasks && (
          <ProjectOverview
            project={project}
            tasks={tasks}
            dashboard={dashboard}
            risks={risks}
            defs={projectDefs}
            usersById={usersById}
            team={team}
            canUpdate={can.updateProject}
            actions={actions}
          />
        )}
      </PendingRegion>

      <TaskSheet
        open={!!params.task}
        pending={sheetNav.isPending}
        task={sheetTask}
        projectId={project.id}
        projectCode={project.code}
        options={taskOptions}
        defs={taskDefs}
        usersById={usersById}
        currentUserId={currentUserId}
        can={{
          update: can.updateTask,
          delete: can.deleteTask,
          logTime: can.logTime,
          manageHours: can.updateProject,
          moderate: can.deleteTask,
        }}
        onClose={() => sheetNav.pushParams({ task: undefined })}
        onOpenTask={actions.openTask}
        onEdit={() => setTaskForm({ open: true, edit: true })}
        onLogTime={(entry) => setTimeEntry({ open: true, taskId: sheetTask?.id, entry: entry ?? null })}
        refresh={() => sheetNav.refresh()}
      />

      <TaskFormDialog
        open={taskForm.open}
        onOpenChange={(open) => setTaskForm((s) => ({ ...s, open }))}
        projectId={project.id}
        projectCode={project.code}
        task={taskForm.edit ? sheetTask : null}
        defaults={taskForm.defaults}
        team={team}
        users={pickerOptions.users}
        options={taskOptions}
        defs={taskDefs}
        onSaved={(taskId) => (taskForm.edit || !taskId ? nav.refresh() : sheetNav.pushParams({ task: taskId }))}
      />

      <TimeEntryDialog
        open={timeEntry.open}
        onOpenChange={(open) => setTimeEntry((s) => ({ ...s, open }))}
        projectId={project.id}
        projectCode={project.code}
        tasks={taskOptions.tasks}
        team={team}
        currentUserId={currentUserId}
        canManage={can.updateProject}
        consumesContract={!!project.contract}
        today={today}
        defaultTaskId={timeEntry.taskId}
        entry={timeEntry.entry}
        onSaved={() => nav.refresh()}
      />

      <ProjectFormDialog
        open={editProject}
        onOpenChange={setEditProject}
        project={project}
        options={pickerOptions}
        defs={projectDefs}
        onSaved={() => nav.refresh()}
      />
    </div>
  )
}
