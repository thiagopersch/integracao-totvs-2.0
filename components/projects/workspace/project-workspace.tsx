"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeft, CalendarDays, ChartGantt, Clock, Gauge, KanbanSquare, LayoutDashboard, List, Loader2, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, ScrollableTabsList, TabsTrigger } from "@/components/ui/tabs"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { PendingRegion } from "@/components/shared/pending-region"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { PriorityBadge, ProgressCell, ProjectHealthBadge, ProjectStatusBadge } from "@/components/projects/project-badges"
import type { ProjectPickerOptions } from "@/components/projects/project-settings-form"
import { WorkspaceFilters } from "@/components/projects/workspace/workspace-filters"
import { KanbanBoard, kanbanStages } from "@/components/projects/workspace/kanban-board"
import { TaskListView } from "@/components/projects/workspace/task-list-view"
import { GanttChart } from "@/components/projects/workspace/gantt-chart"
import { TaskCalendar } from "@/components/projects/workspace/task-calendar"
import { ProjectDashboard } from "@/components/projects/workspace/project-dashboard"
import { ProjectOverview } from "@/components/projects/workspace/project-overview"
import { TaskSheet } from "@/components/projects/workspace/task-sheet"
import { TaskFormDialog } from "@/components/projects/workspace/task-form-dialog"
import { useTaskContextMenu } from "@/components/projects/workspace/task-context-menu"
import {
  DemandFormDialog,
  type DemandFormCatalogs,
  type DemandFormContext,
  type DemandFormDefaults,
  type DemandFormEntity,
} from "@/components/demands/demand-form-dialog"
import { setProjectLifecycleStatus } from "@/actions/projects"
import { getDemandForEdit, getDemandFormData } from "@/actions/demands"
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

type DemandDialogState = { open: boolean; demand?: DemandFormEntity | null; defaults?: DemandFormDefaults }

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
    updateProject: useHasPermission("projects", "update"),
    createDemand: useHasPermission("demands", "create"),
    updateDemand: useHasPermission("demands", "update"),
    deleteDemand: useHasPermission("demands", "delete"),
  }

  const [taskForm, setTaskForm] = useState<{ open: boolean; edit: boolean; defaults?: NewTaskDefaults }>({ open: false, edit: false })
  const [demandDialog, setDemandDialog] = useState<DemandDialogState>({ open: false })
  const [demandForm, setDemandForm] = useState<{ catalogs: DemandFormCatalogs; context: DemandFormContext } | null>(null)
  const [openingDemand, setOpeningDemand] = useState(false)

  const team: TeamMember[] = useMemo(() => project.members.map((m) => ({ id: m.userId, name: m.name, image: m.image })), [project.members])
  const usersById = useMemo(() => Object.fromEntries(pickerOptions.users.map((u) => [u.id, u.name])), [pickerOptions.users])
  const enabledViews = project.settings.enabledViews

  /**
   * "Apontar horas" = a demand of the project's client linked to the project (and the task) — the
   * same form as /demands. Catalogs load on first use; an id opens an existing demand to edit.
   */
  async function openDemand(taskId?: string, demandId?: string) {
    if (!project.client) {
      toast.error("Defina o cliente do projeto para apontar horas")
      return
    }
    setOpeningDemand(true)
    try {
      const data = demandForm ?? (await getDemandFormData())
      if (!demandForm) setDemandForm(data)
      if (demandId) {
        const demand = await getDemandForEdit(demandId)
        if (!demand) return void toast.error("Demanda não encontrada ou fora do seu escopo")
        setDemandDialog({ open: true, demand })
      } else {
        const task = taskId ? taskOptions.tasks.find((t) => t.id === taskId) : undefined
        setDemandDialog({
          open: true,
          demand: null,
          defaults: { projectId: project.id, projectTaskId: taskId, clientId: project.client.id, name: task?.title },
        })
      }
    } catch {
      toast.error("Não foi possível abrir o formulário de demanda")
    } finally {
      setOpeningDemand(false)
    }
  }

  const actions: WorkspaceActions = {
    openTask: (taskId) => sheetNav.pushParams({ task: taskId }),
    newTask: (defaults) => setTaskForm({ open: true, edit: false, defaults }),
    logTime: (taskId) => void openDemand(taskId),
    refresh: () => nav.refresh(),
  }
  const taskMenu = useTaskContextMenu({
    projectId: project.id,
    stages: project.stages,
    phases: project.phases,
    team,
    can: { create: can.createTask, update: can.updateTask, delete: can.deleteTask, logTime: can.createDemand && !!project.client },
    actions,
  })

  async function changeStatus(status: ProjectStatus) {
    const result = await setProjectLifecycleStatus(project.id, { status })
    if (result.success) {
      toast.success(`Status: ${PROJECT_STATUS_LABELS[status]}`)
      nav.refresh()
    } else toast.error(result.error || "Erro ao alterar status")
  }

  const sheetTask = taskDetail && taskDetail.id === params.task ? taskDetail : null
  const showFilters = !["overview", "dashboard"].includes(params.view)
  const projectTasksForDemand = taskOptions.tasks.filter((t) => t.status !== "CANCELLED").map((t) => ({ id: t.id, number: t.number, title: t.title }))

  const logTimeButton = can.createDemand && (
    <WithTooltip label={project.client ? undefined : "Defina o cliente do projeto para apontar horas"} disabledSafe>
      <Button variant="outline" size="sm" onClick={() => actions.logTime()} disabled={!project.client || openingDemand}>
        {openingDemand ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Clock className="mr-1.5 h-4 w-4" />} Apontar horas
      </Button>
    </WithTooltip>
  )

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
              {logTimeButton}
              {can.updateProject && (
                <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/projetos/gestao/${project.id}/configuracoes`} />}>
                  <Settings className="mr-1.5 h-4 w-4" /> Configurações
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

      {enabledViews.length > 1 && (
        <Tabs
          value={params.view}
          onValueChange={(v) => nav.pushParams({ view: v === project.settings.defaultView ? undefined : (v as string), page: undefined, sort: undefined })}
        >
          <ScrollableTabsList>
            {enabledViews.map((view) => {
              const Icon = VIEW_ICONS[view]
              return (
                <TabsTrigger key={view} value={view}>
                  <Icon className="mr-1.5 h-4 w-4" /> {WORKSPACE_VIEW_LABELS[view]}
                </TabsTrigger>
              )
            })}
          </ScrollableTabsList>
        </Tabs>
      )}

      {showFilters && (
        <WorkspaceFilters
          view={params.view}
          filters={params.filters}
          stages={project.stages}
          phases={project.phases}
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
            stages={kanbanStages(project.stages, params.filters.stage, params.filters.showCancelled)}
            phases={project.phases}
            swimlane={params.kanban.swimlane}
            today={today}
            canCreate={can.createTask}
            canUpdate={can.updateTask}
            actions={actions}
            taskMenu={taskMenu}
          />
        )}
        {params.view === "list" && tasks && (
          <TaskListView
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            params={params.list}
            defs={taskDefs}
            stages={project.stages}
            phases={project.phases}
            usersById={usersById}
            today={today}
            can={{ create: can.createTask, update: can.updateTask, delete: can.deleteTask, logTime: can.createDemand && !!project.client }}
            actions={actions}
            taskMenu={taskMenu}
          />
        )}
        {params.view === "gantt" && tasks && (
          <GanttChart
            projectId={project.id}
            projectCode={project.code}
            tasks={tasks}
            stages={project.stages}
            phases={project.phases}
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
            stages={project.stages}
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
      {taskMenu.dialog}

      <TaskSheet
        open={!!params.task}
        pending={sheetNav.isPending}
        task={sheetTask}
        projectId={project.id}
        projectCode={project.code}
        stages={project.stages}
        phases={project.phases}
        team={team}
        options={taskOptions}
        defs={taskDefs}
        usersById={usersById}
        currentUserId={currentUserId}
        can={{
          update: can.updateTask,
          delete: can.deleteTask,
          logTime: can.createDemand && !!project.client,
          editDemand: can.updateDemand,
          deleteDemand: can.deleteDemand,
          moderate: can.deleteTask,
        }}
        onClose={() => sheetNav.pushParams({ task: undefined })}
        onOpenTask={actions.openTask}
        onEdit={() => setTaskForm({ open: true, edit: true })}
        onLogTime={(demandId) => void openDemand(sheetTask?.id, demandId)}
        refresh={() => sheetNav.refresh()}
      />

      <TaskFormDialog
        open={taskForm.open}
        onOpenChange={(open) => setTaskForm((s) => ({ ...s, open }))}
        projectId={project.id}
        projectCode={project.code}
        task={taskForm.edit ? sheetTask : null}
        defaults={taskForm.defaults}
        stages={project.stages}
        phases={project.phases}
        team={team}
        users={pickerOptions.users}
        options={taskOptions}
        defs={taskDefs}
        // Creating only saves and refreshes the board — the sheet opens only by clicking a card.
        onSaved={() => nav.refresh()}
      />

      {demandForm && (
        <DemandFormDialog
          open={demandDialog.open}
          onOpenChange={(open) => setDemandDialog((s) => ({ ...s, open }))}
          catalogs={demandForm.catalogs}
          context={demandForm.context}
          demand={demandDialog.demand}
          defaults={demandDialog.defaults}
          lockProject={!demandDialog.demand}
          initialTasks={projectTasksForDemand}
          onSaved={() => (params.task ? sheetNav.refresh() : nav.refresh())}
        />
      )}
    </div>
  )
}
