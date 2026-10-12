"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { FolderOpen, Plus, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { ColorBadge } from "@/components/shared/color-badge"
import { DateCell } from "@/components/shared/date-cell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import type { ProjectPickerOptions } from "@/components/projects/project-settings-form"
import { PriorityBadge, ProgressCell, ProjectHealthBadge, ProjectStatusBadge } from "@/components/projects/project-badges"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import { bulkDeleteProjects, deleteProject, setProjectLifecycleStatus } from "@/actions/projects"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { CUSTOM_FIELD_PARAM_PREFIX, type CustomFieldDef } from "@/lib/custom-fields"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_HEALTH_COLORS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUSES,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  formatHours,
} from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import type { ProjectRow } from "@/services/project.service"
import type { PaginationMeta } from "@/types/common"

interface ProjectTableProps {
  data: ProjectRow[]
  meta: PaginationMeta
  options: ProjectPickerOptions
  defs: CustomFieldDef[]
}

const BASE_SORTABLE = [
  "code",
  "name",
  "clientName",
  "managerName",
  "status",
  "health",
  "priority",
  "plannedEndDate",
  "progress",
  "loggedHours",
  "overdueCount",
]

/** Custom field types that make sense as an exact-match filter in the panel. */
const FILTERABLE_TYPES = new Set(["SELECT", "MULTISELECT", "CHECKBOX_GROUP", "BOOLEAN", "CHECKBOX", "USER", "TEXT"])

export function ProjectTable({ data, meta, options, defs }: ProjectTableProps) {
  const {
    searchParams,
    deleteDialog,
    setDeleteDialog,
    pushParams,
    refresh,
    isPending,
    handleDelete,
    sort,
    onSortChange,
    router,
  } = useCrudTable<ProjectRow>({
    deleteAction: deleteProject,
    deleteSuccessMessage: "Projeto excluído com sucesso",
    defaultSort: { field: "updatedAt", direction: "desc" },
  })
  const canCreate = useHasPermission("projects", "create")
  const canUpdate = useHasPermission("projects", "update")
  const canDelete = useHasPermission("projects", "delete")

  const listDefs = useMemo(() => defs.filter((d) => d.showInList), [defs])
  const usersById = useMemo(() => Object.fromEntries(options.users.map((u) => [u.id, u.name])), [options.users])
  const sortableColumns = useMemo(() => [...BASE_SORTABLE, ...listDefs.map((d) => `${CUSTOM_FIELD_PARAM_PREFIX}${d.id}`)], [listDefs])

  const filterKeys = ["status", "health", "priority", "clientId", "managerId", "mine", ...defs.map((d) => `${CUSTOM_FIELD_PARAM_PREFIX}${d.id}`)]
  const [filters, setFilters] = useState<Record<string, string>>(() =>
    Object.fromEntries(filterKeys.map((k) => [k, searchParams.get(k) || ""]))
  )
  const setFilter = (key: string, value: string) => setFilters((prev) => ({ ...prev, [key]: value }))

  async function changeStatus(project: ProjectRow, status: string) {
    const result = await setProjectLifecycleStatus(project.id, { status })
    if (result.success) {
      toast.success(`Projeto ${project.code} → ${PROJECT_STATUS_LABELS[status as keyof typeof PROJECT_STATUS_LABELS]}`)
      refresh()
    } else toast.error(result.error || "Erro ao alterar status")
  }

  const columns: ColumnDef<ProjectRow>[] = useMemo(() => {
    const cols: ColumnDef<ProjectRow>[] = [
      createSelectColumn<ProjectRow>(),
      {
        accessorKey: "code",
        header: "Código",
        cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span>,
      },
      {
        accessorKey: "name",
        header: "Projeto",
        cell: ({ row }) => (
          <Link
            href={`/projetos/gestao/${row.original.id}`}
            className="flex items-center gap-2 font-medium hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.original.color }} />
            {row.original.name}
          </Link>
        ),
      },
      {
        id: "clientName",
        header: "Cliente",
        cell: ({ row }) =>
          row.original.client ? (
            <ColorBadge label={row.original.client.name} color={row.original.client.color} solid />
          ) : (
            <span className="text-xs text-muted-foreground">Interno</span>
          ),
      },
      {
        id: "managerName",
        header: "Gerente",
        cell: ({ row }) => row.original.manager?.name ?? <span className="text-muted-foreground">-</span>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <ProjectStatusBadge status={row.original.status} />,
      },
      {
        accessorKey: "health",
        header: "Saúde",
        cell: ({ row }) => (
          <ProjectHealthBadge health={row.original.health} auto={row.original.healthAuto} reasons={row.original.healthReasons} />
        ),
      },
      {
        accessorKey: "priority",
        header: "Prioridade",
        cell: ({ row }) => <PriorityBadge priority={row.original.priority} />,
      },
      {
        accessorKey: "plannedEndDate",
        header: "Término previsto",
        cell: ({ row }) => {
          const date = row.original.plannedEndDate
          if (!date) return <span className="text-muted-foreground">-</span>
          return <DateCell date={date} timeZone="UTC">{formatDateOnly(date)}</DateCell>
        },
      },
      {
        accessorKey: "progress",
        header: "Progresso",
        cell: ({ row }) => <ProgressCell value={row.original.progress} color={row.original.color} />,
      },
      {
        accessorKey: "loggedHours",
        header: "Horas",
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatHours(row.original.loggedHours)}
            {row.original.budgetHours ? <span className="text-muted-foreground"> / {formatHours(row.original.budgetHours)}</span> : null}
          </span>
        ),
      },
      {
        accessorKey: "overdueCount",
        header: "Tarefas",
        cell: ({ row }) => (
          <div className="flex flex-col text-xs">
            <span>
              {row.original.doneCount}/{row.original.taskCount} concluídas
            </span>
            {row.original.overdueCount > 0 && <span className="text-destructive">{row.original.overdueCount} atrasada(s)</span>}
          </div>
        ),
      },
      ...listDefs.map<ColumnDef<ProjectRow>>((def) => ({
        id: `${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`,
        header: def.label,
        cell: ({ row }) => <CustomFieldValueView def={def} value={row.original.customFields[def.id]} usersById={usersById} />,
      })),
    ]
    cols.push({
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          beforeEdit={
            <>
              <DropdownMenuItem onClick={() => router.push(`/projetos/gestao/${row.original.id}`)}>
                <FolderOpen className="mr-2 h-4 w-4" /> Abrir projeto
              </DropdownMenuItem>
              {canUpdate && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <RefreshCcw className="mr-2 h-4 w-4" /> Alterar status
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {PROJECT_STATUSES.filter((s) => s !== row.original.status).map((s) => (
                      <DropdownMenuItem key={s} onClick={() => changeStatus(row.original, s)}>
                        <ColorBadge label={PROJECT_STATUS_LABELS[s]} color={PROJECT_STATUS_COLORS[s]} />
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}
            </>
          }
          onEdit={canUpdate ? () => router.push(`/projetos/gestao/${row.original.id}/configuracoes`) : undefined}
          editLabel="Configurações"
          onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        />
      ),
    })
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpdate, canDelete, listDefs, usersById])

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushParams({ ...Object.fromEntries(filterKeys.map((k) => [k, filters[k] || undefined])), page: 1 })
      }
      onClear={() => {
        setFilters(Object.fromEntries(filterKeys.map((k) => [k, ""])))
        pushParams({ ...Object.fromEntries(filterKeys.map((k) => [k, undefined])), page: 1 })
      }}
    >
      <div className="flex items-center gap-2">
        <Switch id="mine" checked={filters.mine === "true"} onCheckedChange={(c) => setFilter("mine", c ? "true" : "")} />
        <Label htmlFor="mine">Somente meus projetos</Label>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <OptionSelect options={toOptions(PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS)} value={filters.status} onChange={(v) => setFilter("status", v)} emptyLabel="Todos" />
      </div>
      <div className="space-y-2">
        <Label>Saúde</Label>
        <OptionSelect options={toOptions(PROJECT_HEALTH_LABELS, PROJECT_HEALTH_COLORS)} value={filters.health} onChange={(v) => setFilter("health", v)} emptyLabel="Todas" />
      </div>
      <div className="space-y-2">
        <Label>Prioridade</Label>
        <OptionSelect options={toOptions(PRIORITY_LABELS, PRIORITY_COLORS)} value={filters.priority} onChange={(v) => setFilter("priority", v)} emptyLabel="Todas" />
      </div>
      <div className="space-y-2">
        <Label>Cliente</Label>
        <OptionSelect
          options={options.clients.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          value={filters.clientId}
          onChange={(v) => setFilter("clientId", v)}
          emptyLabel="Todos"
        />
      </div>
      <div className="space-y-2">
        <Label>Gerente</Label>
        <OptionSelect
          options={options.users.map((u) => ({ value: u.id, label: u.name }))}
          value={filters.managerId}
          onChange={(v) => setFilter("managerId", v)}
          emptyLabel="Todos"
        />
      </div>
      {defs.filter((d) => FILTERABLE_TYPES.has(d.type)).map((def) => {
        const key = `${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`
        return (
          <div key={def.id} className="space-y-2">
            <Label>{def.label}</Label>
            {def.type === "TEXT" ? (
              <Input value={filters[key] ?? ""} onChange={(e) => setFilter(key, e.target.value)} placeholder="Contém..." />
            ) : (
              <OptionSelect
                options={
                  def.type === "BOOLEAN" || def.type === "CHECKBOX"
                    ? [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }]
                    : def.type === "USER"
                      ? options.users.map((u) => ({ value: u.id, label: u.name }))
                      : (def.options ?? []).map((o) => ({ value: o.id, label: o.label, color: o.color || undefined }))
                }
                value={filters[key]}
                onChange={(v) => setFilter(key, v)}
                emptyLabel="Todos"
              />
            )}
          </div>
        )
      })}
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Gestão de Projetos" description="Portfólio de projetos: escopo, prazos, saúde, equipe e consumo de horas" />

      <DataTable
        refreshing={isPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome, código ou patrocinador..."
        searchDefaultValue={searchParams.get("search") ?? ""}
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        onRowClick={(row) => router.push(`/projetos/gestao/${row.id}`)}
        toolbarActions={
          canCreate ? (
            <Button onClick={() => router.push("/projetos/gestao/novo")}>
              <Plus className="mr-2 h-4 w-4" /> Novo Projeto
            </Button>
          ) : undefined
        }
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={sortableColumns}
        emptyMessage="Nenhum projeto encontrado."
        bulkDelete={
          canDelete
            ? {
                getId: (row) => row.id,
                getRowLabel: (row) => `${row.code} — ${row.name}`,
                action: bulkDeleteProjects,
                confirmDescription: (count) =>
                  `Excluir ${count} projeto(s) com suas tarefas? Projetos com horas apontadas não podem ser excluídos.`,
                onSuccess: () => refresh(),
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Projeto"
        description="Excluir este projeto e todas as suas tarefas? Projetos com horas apontadas não podem ser excluídos."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
