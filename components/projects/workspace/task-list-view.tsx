"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Clock, Diamond, FolderOpen, Plus } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { ColorBadge } from "@/components/shared/color-badge"
import { Button } from "@/components/ui/button"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { PhaseBadge, PriorityBadge, ProgressCell, StageBadge } from "@/components/projects/project-badges"
import { DueDateLabel } from "@/components/projects/workspace/task-card-bits"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import { bulkDeleteProjectTasks } from "@/actions/project-tasks"
import { useUrlParams } from "@/hooks/use-url-params"
import { buildTaskTree } from "@/lib/project-tasks"
import { CUSTOM_FIELD_PARAM_PREFIX, customFieldSortKey, type CustomFieldDef } from "@/lib/custom-fields"
import { PRIORITIES, formatHours, taskKey, type PhaseRef, type StageRef } from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import type { WorkspaceParams } from "@/lib/project-workspace-params"
import type { ProjectTaskDTO, WorkspaceActions } from "@/components/projects/workspace/types"
import type { TaskContextMenu } from "@/components/projects/workspace/task-context-menu"

type Row = ProjectTaskDTO & { depth: number }

const BASE_SORTABLE = ["number", "title", "stage", "phase", "priority", "assigneeName", "startDate", "dueDate", "progress", "loggedMinutes"]

type SortContext = { defsById: Map<string, CustomFieldDef>; usersById: Record<string, string>; stageIndex: Map<string, number>; phaseIndex: Map<string, number> }

function sortValue(task: ProjectTaskDTO, field: string, { defsById, usersById, stageIndex, phaseIndex }: SortContext): string | number | null {
  if (field.startsWith(CUSTOM_FIELD_PARAM_PREFIX)) {
    const def = defsById.get(field.slice(CUSTOM_FIELD_PARAM_PREFIX.length))
    if (!def) return null
    const key = customFieldSortKey(def, task.customFields[def.id], usersById)
    return key === "" ? null : key
  }
  switch (field) {
    case "number":
      return task.number
    case "title":
      return task.title.toLocaleLowerCase("pt-BR")
    case "stage":
      return task.stageId ? (stageIndex.get(task.stageId) ?? null) : null
    case "phase":
      return task.phaseId ? (phaseIndex.get(task.phaseId) ?? null) : null
    case "priority":
      return PRIORITIES.indexOf(task.priority)
    case "assigneeName":
      return task.assignee?.name.toLocaleLowerCase("pt-BR") ?? null
    case "startDate":
    case "dueDate":
      return task[field] ? new Date(task[field]!).getTime() : null
    case "progress":
      return task.progress
    case "loggedMinutes":
      return task.loggedMinutes
    default:
      return null
  }
}

interface TaskListViewProps {
  projectId: string
  projectCode: string
  tasks: ProjectTaskDTO[]
  params: WorkspaceParams["list"]
  defs: CustomFieldDef[]
  stages: StageRef[]
  phases: PhaseRef[]
  usersById: Record<string, string>
  today: string
  can: { create: boolean; update: boolean; delete: boolean; logTime: boolean }
  actions: WorkspaceActions
  taskMenu: TaskContextMenu
}

export function TaskListView({ projectId, projectCode, tasks, params, defs, stages, phases, usersById, today, can, actions, taskMenu }: TaskListViewProps) {
  const { pushParams } = useUrlParams()
  const listDefs = useMemo(() => defs.filter((d) => d.showInList), [defs])
  const sortContext = useMemo<SortContext>(
    () => ({
      defsById: new Map(defs.map((d) => [d.id, d])),
      usersById,
      stageIndex: new Map(stages.map((s, i) => [s.id, i])),
      phaseIndex: new Map(phases.map((p, i) => [p.id, i])),
    }),
    [defs, usersById, stages, phases]
  )
  const stageById = useMemo(() => new Map(stages.map((s) => [s.id, s])), [stages])
  const phaseById = useMemo(() => new Map(phases.map((p) => [p.id, p])), [phases])

  const rows: Row[] = useMemo(() => {
    if (!params.sort) return buildTaskTree(tasks).map(({ task, depth }) => ({ ...task, depth }))
    const { field, direction } = params.sort
    return [...tasks]
      .sort((a, b) => {
        const va = sortValue(a, field, sortContext)
        const vb = sortValue(b, field, sortContext)
        if (va === null && vb === null) return 0
        if (va === null) return 1
        if (vb === null) return -1
        const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR")
        return direction === "asc" ? cmp : -cmp
      })
      .map((task) => ({ ...task, depth: 0 }))
  }, [tasks, params.sort, sortContext])

  const pageCount = Math.max(1, Math.ceil(rows.length / params.pageSize))
  const page = Math.min(params.page, pageCount)
  const pageRows = rows.slice((page - 1) * params.pageSize, page * params.pageSize)

  const columns: ColumnDef<Row>[] = useMemo(() => {
    const cols: ColumnDef<Row>[] = [
      createSelectColumn<Row>(),
      {
        id: "number",
        header: "Código",
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, row.original.number)}</span>,
      },
      {
        id: "title",
        header: "Tarefa",
        cell: ({ row }) => (
          <div className="flex min-w-56 items-center gap-1.5" style={{ paddingLeft: row.original.depth * 18 }}>
            {row.original.depth > 0 && <span className="text-muted-foreground">↳</span>}
            {row.original.isMilestone && <Diamond className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />}
            <span className={row.original.childCount > 0 ? "font-semibold" : "font-medium"}>{row.original.title}</span>
            {row.original.tags.slice(0, 2).map((t) => (
              <ColorBadge key={t.id} label={t.name} color={t.color} />
            ))}
          </div>
        ),
      },
      { id: "stage", header: "Etapa", cell: ({ row }) => <StageBadge stage={row.original.stageId ? stageById.get(row.original.stageId) : null} /> },
      { id: "phase", header: "Fase", cell: ({ row }) => <PhaseBadge phase={row.original.phaseId ? phaseById.get(row.original.phaseId) : null} /> },
      { id: "priority", header: "Prioridade", cell: ({ row }) => <PriorityBadge priority={row.original.priority} /> },
      {
        id: "assigneeName",
        header: "Responsável",
        cell: ({ row }) => row.original.assignee?.name ?? <span className="text-muted-foreground">-</span>,
      },
      {
        id: "startDate",
        header: "Início",
        cell: ({ row }) => (row.original.startDate ? formatDateOnly(row.original.startDate) : <span className="text-muted-foreground">-</span>),
      },
      {
        id: "dueDate",
        header: "Prazo",
        cell: ({ row }) => (row.original.dueDate ? <DueDateLabel task={row.original} today={today} /> : <span className="text-muted-foreground">-</span>),
      },
      { id: "progress", header: "Progresso", cell: ({ row }) => <ProgressCell value={row.original.status === "DONE" ? 100 : row.original.progress} /> },
      {
        id: "loggedMinutes",
        header: "Horas",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatHours(row.original.loggedMinutes, "minutes")}
            {row.original.estimateHours ? <span className="text-muted-foreground"> / {formatHours(row.original.estimateHours)}</span> : null}
          </span>
        ),
      },
      ...listDefs.map<ColumnDef<Row>>((def) => ({
        id: `${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`,
        header: def.label,
        cell: ({ row }) => <CustomFieldValueView def={def} value={row.original.customFields[def.id]} usersById={usersById} />,
      })),
      {
        id: "actions",
        cell: ({ row }) => (
          <EntityActionsCell
            beforeEdit={
              <>
                <DropdownMenuItem onClick={() => actions.openTask(row.original.id)}>
                  <FolderOpen className="mr-2 h-4 w-4" /> Abrir
                </DropdownMenuItem>
                {can.create && (
                  <DropdownMenuItem onClick={() => actions.newTask({ parentId: row.original.id })}>
                    <Plus className="mr-2 h-4 w-4" /> Nova subtarefa
                  </DropdownMenuItem>
                )}
                {can.logTime && (
                  <DropdownMenuItem onClick={() => actions.logTime(row.original.id)}>
                    <Clock className="mr-2 h-4 w-4" /> Apontar horas
                  </DropdownMenuItem>
                )}
              </>
            }
          />
        ),
      },
    ]
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listDefs, usersById, projectCode, today, can.create, can.logTime, stageById, phaseById])

  return (
    <DataTable
      columns={columns}
      data={pageRows}
      page={page}
      pageSize={params.pageSize}
      total={rows.length}
      pageCount={pageCount}
      onPageChange={(p) => pushParams({ page: p })}
      onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
      searchable={false}
      onRowClick={(row) => actions.openTask(row.id)}
      rowContextMenu={taskMenu.content}
      sort={params.sort}
      onSortChange={(next) => pushParams({ sort: `${next.field}:${next.direction}`, page: 1 })}
      sortableColumns={[...BASE_SORTABLE, ...listDefs.map((d) => `${CUSTOM_FIELD_PARAM_PREFIX}${d.id}`)]}
      emptyMessage="Nenhuma tarefa encontrada com os filtros atuais."
      toolbarActions={
        can.create ? (
          <Button onClick={() => actions.newTask()}>
            <Plus className="mr-2 h-4 w-4" /> Nova tarefa
          </Button>
        ) : undefined
      }
      bulkDelete={
        can.delete
          ? {
              getId: (row) => row.id,
              getRowLabel: (row) => `${taskKey(projectCode, row.number)} ${row.title}`,
              action: (ids) => bulkDeleteProjectTasks(projectId, ids),
              confirmDescription: (count) => `Excluir ${count} tarefa(s)? Tarefas com subtarefas ou horas apontadas não serão excluídas.`,
              onSuccess: actions.refresh,
            }
          : undefined
      }
    />
  )
}
