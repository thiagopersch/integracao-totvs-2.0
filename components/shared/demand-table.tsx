"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { DateCell } from "@/components/shared/date-cell"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { ColorBadge } from "@/components/shared/color-badge"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import { MultiSelect, type MultiSelectItem } from "@/components/ui/multi-select"
import { Slider } from "@/components/ui/slider"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { format, parse } from "date-fns"
import type { DateRange } from "react-day-picker"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Plus, Copy } from "lucide-react"
import { deleteDemand, duplicateDemand, bulkDeleteDemands, type getDemandFilterOptions } from "@/actions/demands"
import { formatDateOnly } from "@/utils/format"
import { TruncatedText } from "@/components/shared/truncated-text"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { usePeriodFilter } from "@/hooks/use-period-filter"
import { PeriodSelect } from "@/components/shared/period-select"
import { TotalsByClientSummary } from "@/components/shared/totals-by-client-summary"
import { DemandExportDialog } from "@/components/shared/demand-export-dialog"
import { DemandImportDialog } from "@/components/shared/demand-import-dialog"
import type { Analyst, Client, DemandType, Tag } from "@/generated/prisma/client"
import { demandAnalysts, demandDepartments, demandRequesters, demandTypesOf } from "@/lib/demand-people"
import type { PaginationMeta } from "@/types/common"
import type { Period } from "@/lib/period"
import Link from "next/link"
import { DemandFormDialog, type DemandFormCatalogs, type DemandFormContext } from "@/components/demands/demand-form-dialog"

type DemandRow = {
  id: string
  name: string
  description: string
  date: string | Date
  startTime: string | Date | null
  endTime: string | Date | null
  durationMinutes: number
  priority: string
  status: string
  notes: string | null
  demandAnalysts: { analyst: { id: string; name: string; color: string; userId?: string | null } }[]
  client: { id: string; name: string; color: string } | null
  demandRequesters: { requester: { id: string; name: string; color: string } }[]
  demandDepartments: { department: { id: string; name: string; color: string } }[]
  demandDemandTypes: { demandType: { id: string; name: string; color: string } }[]
  demandTags: { tag: Tag }[]
  project: { id: string; code: string; name: string; color: string } | null
  projectTask: { id: string; number: number; title: string } | null
}

interface DemandTableProps {
  data: DemandRow[]
  meta: PaginationMeta
  analysts: Analyst[]
  clients: Client[]
  filterOptions: Awaited<ReturnType<typeof getDemandFilterOptions>>
  requesters: DemandFormCatalogs["requesters"]
  departments: DemandFormCatalogs["departments"]
  demandTypes: DemandType[]
  tags: Tag[]
  totalsByClient: { clientId: string; clientName: string; clientColor: string; hours: number }[]
  period: Period | null
  years: number[]
  monthsByYear: Record<number, number[]>
  /** Projects to link + the user's own analyst (default "Analista"). */
  formContext: DemandFormContext
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "#f97316",
  IN_PROGRESS: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#22c55e",
  MEDIUM: "#3b82f6",
  HIGH: "#f97316",
  URGENT: "#ef4444",
}

function formatDurationHours(minutes: number): string {
  return (minutes / 60).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SORTABLE_COLUMNS = ["name", "projectName", "date", "priority", "status"]

/** Multi-select filters, keyed by their URL param (comma-separated ids/enum values). */
const MULTI_FILTER_KEYS = ["clientId", "projectId", "analystId", "requesterId", "departmentId", "demandTypeId", "priority", "status", "tagId"] as const
type MultiFilterKey = (typeof MULTI_FILTER_KEYS)[number]

const MIN_DURATION_STEP = 15
const MIN_DURATION_FLOOR_MAX = 8 * 60

function parseDayParam(value: string | null): Date | undefined {
  return value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
}
const VISIBLE_TAGS = 2

/** First `VISIBLE_TAGS` colored badges inline, the rest behind a "+N" tooltip (tags, analysts, requesters, departments). */
function BadgeList({ items }: { items: { id: string; name: string; color: string }[] }) {
  if (items.length === 0) return "-"
  const visible = items.slice(0, VISIBLE_TAGS)
  const hidden = items.slice(VISIBLE_TAGS)
  return (
    <div className="flex items-center gap-1">
      {visible.map((item) => (
        <ColorBadge key={item.id} label={item.name} color={item.color} />
      ))}
      {hidden.length > 0 && (
        <Tooltip>
          <TooltipTrigger
            render={
              <Badge variant="secondary" className="cursor-default">
                +{hidden.length}
              </Badge>
            }
          />
          <TooltipContent variant="surface">
            <div className="flex flex-col gap-1">
              {hidden.map((item) => (
                <ColorBadge key={item.id} label={item.name} color={item.color} />
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  )
}

export function DemandTable({
  data,
  meta,
  analysts,
  clients,
  filterOptions,
  requesters,
  departments,
  demandTypes,
  tags,
  totalsByClient,
  period: initialPeriod,
  years,
  monthsByYear,
  formContext,
}: DemandTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    sort,
    onSortChange,
    refresh,
    isPending,
  } = useCrudTable<DemandRow>({
    deleteAction: deleteDemand,
    deleteSuccessMessage: "Demanda excluída com sucesso",
    defaultSort: { field: "date", direction: "desc" },
  })
  const canCreate = useHasPermission("demands", "create")
  const canUpdate = useHasPermission("demands", "update")
  const canDelete = useHasPermission("demands", "delete")
  const [multiFilters, setMultiFilters] = useState<Record<MultiFilterKey, string[]>>(
    () =>
      Object.fromEntries(
        MULTI_FILTER_KEYS.map((key) => [key, searchParams.get(key)?.split(",").filter(Boolean) ?? []])
      ) as Record<MultiFilterKey, string[]>
  )
  const [minDuration, setMinDuration] = useState(Number(searchParams.get("minDuration")) || 0)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = parseDayParam(searchParams.get("dateFrom"))
    return from ? { from, to: parseDayParam(searchParams.get("dateTo")) } : undefined
  })
  const { period, setPeriod, isPending: isPeriodPending } = usePeriodFilter(initialPeriod)

  const columns: ColumnDef<DemandRow>[] = useMemo(() => {
    async function handleDuplicate(id: string) {
      const toastId = toast.loading("Duplicando demanda…")
      const result = await duplicateDemand(id).catch(() => ({ success: false as const, error: undefined, data: undefined }))
      if (!result.success || !result.data) {
        toast.error(result.error || "Erro ao duplicar", { id: toastId })
        return
      }
      toast.success("Demanda duplicada — ajuste a cópia", { id: toastId })
      refresh()
      if (canUpdate) {
        setEditDialog({ open: true, entity: result.data })
      }
    }

    const columns: ColumnDef<DemandRow>[] = [
    createSelectColumn<DemandRow>(),
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <TruncatedText text={row.original.name} />,
    },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) =>
        row.original.client ? (
          <ColorBadge label={row.original.client.name} color={row.original.client.color} solid />
        ) : (
          "-"
        ),
    },
    {
      id: "projectName",
      header: "Projeto",
      cell: ({ row }) =>
        row.original.project ? (
          <Link
            href={`/projetos/gestao/${row.original.project.id}${row.original.projectTask ? `?task=${row.original.projectTask.id}` : ""}`}
            className="flex max-w-56 flex-col text-xs hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="flex items-center gap-1.5 font-medium">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: row.original.project.color }} />
              <span className="truncate">{row.original.project.code} — {row.original.project.name}</span>
            </span>
            {row.original.projectTask && <span className="truncate text-muted-foreground">#{row.original.projectTask.number} {row.original.projectTask.title}</span>}
          </Link>
        ) : (
          "-"
        ),
    },
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => {
        const date = row.getValue("date") as string
        return <DateCell date={date} timeZone="UTC">{formatDateOnly(date)}</DateCell>
      },
    },
    {
      accessorKey: "durationMinutes",
      header: "Duração (h)",
      cell: ({ row }) => `${formatDurationHours(row.getValue("durationMinutes") as number)}h`,
    },
    {
      id: "analyst",
      header: "Analista",
      cell: ({ row }) => <BadgeList items={demandAnalysts(row.original)} />,
    },
    { id: "requester", header: "Solicitante", cell: ({ row }) => <BadgeList items={demandRequesters(row.original)} /> },
    { id: "department", header: "Departamento", cell: ({ row }) => <BadgeList items={demandDepartments(row.original)} /> },
    {
      id: "demandType",
      header: "Tipo",
      cell: ({ row }) =>
        <BadgeList items={demandTypesOf(row.original)} />,
    },
    {
      accessorKey: "priority",
      header: "Prioridade",
      cell: ({ row }) => {
        const priority = row.getValue("priority") as string
        return <ColorBadge label={PRIORITY_LABELS[priority]} color={PRIORITY_COLORS[priority]} />
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return <ColorBadge label={STATUS_LABELS[status]} color={STATUS_COLORS[status]} />
      },
    },
    {
      id: "tags",
      header: "Tags",
      cell: ({ row }) => <BadgeList items={row.original.demandTags.map(({ tag }) => tag)} />,
    },
  ]

  const actionsColumn: ColumnDef<DemandRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        extraItems={
          canCreate ? (
            <DropdownMenuItem onClick={() => handleDuplicate(row.original.id)}>
              <Copy className="h-4 w-4 mr-2" /> Duplicar
            </DropdownMenuItem>
          ) : undefined
        }
      />
    ),
  }
    if (canCreate || canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canCreate, canUpdate, canDelete, router, setEditDialog, setDeleteDialog])

  const newDialog = (
    <>
      <Button onClick={() => setEditDialog({ open: true })}>
        <Plus className="h-4 w-4 mr-2" /> Nova Demanda
      </Button>
      <DemandFormDialog
        open={editDialog.open}
        onOpenChange={(open) => setEditDialog({ open, entity: open ? editDialog.entity : undefined })}
        catalogs={{ analysts, clients, requesters, departments, demandTypes, tags }}
        context={formContext}
        demand={editDialog.entity}
        onSaved={refresh}
      />
    </>
  )

  function setMultiFilter(key: MultiFilterKey) {
    return (value: string[]) => setMultiFilters((prev) => ({ ...prev, [key]: value }))
  }

  function applyFilters() {
    pushParams({
      ...Object.fromEntries(MULTI_FILTER_KEYS.map((key) => [key, multiFilters[key].join(",") || undefined])),
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      minDuration: minDuration || undefined,
      page: 1,
    })
  }

  function clearFilters() {
    setMultiFilters(Object.fromEntries(MULTI_FILTER_KEYS.map((key) => [key, []])) as unknown as Record<MultiFilterKey, string[]>)
    setDateRange(undefined)
    setMinDuration(0)
    pushParams({
      ...Object.fromEntries(MULTI_FILTER_KEYS.map((key) => [key, undefined])),
      dateFrom: undefined,
      dateTo: undefined,
      minDuration: undefined,
      page: 1,
    })
  }

  // Slider tops out at the longest demand in the period (whole hours), never below 8h.
  const maxDurationFilter = Math.max(MIN_DURATION_FLOOR_MAX, Math.ceil(filterOptions.maxDurationMinutes / 60) * 60)

  const multiFilterFields: { key: MultiFilterKey; label: string; items: MultiSelectItem[] }[] = [
    { key: "clientId", label: "Cliente", items: filterOptions.clients.map((c) => ({ value: c.id, label: c.name, color: c.color })) },
    {
      key: "projectId",
      label: "Projeto",
      items: [
        { value: "none", label: "Sem projeto" },
        ...filterOptions.projects.map((p) => ({ value: p.id, label: `${p.code} — ${p.name}`, color: p.color })),
      ],
    },
    { key: "analystId", label: "Analista", items: filterOptions.analysts.map((a) => ({ value: a.id, label: a.name, color: a.color })) },
    { key: "requesterId", label: "Solicitante", items: filterOptions.requesters.map((r) => ({ value: r.id, label: r.name, color: r.color })) },
    { key: "departmentId", label: "Departamento", items: filterOptions.departments.map((d) => ({ value: d.id, label: d.name, color: d.color })) },
    { key: "demandTypeId", label: "Tipo", items: filterOptions.demandTypes.map((t) => ({ value: t.id, label: t.name, color: t.color })) },
    {
      key: "priority",
      label: "Prioridade",
      items: filterOptions.priorities.map((p) => ({ value: p, label: PRIORITY_LABELS[p], color: PRIORITY_COLORS[p] })),
    },
    {
      key: "status",
      label: "Status",
      items: filterOptions.statuses.map((st) => ({ value: st, label: STATUS_LABELS[st], color: STATUS_COLORS[st] })),
    },
    { key: "tagId", label: "Tags", items: filterOptions.tags.map((t) => ({ value: t.id, label: t.name, color: t.color })) },
  ]

  function renderMultiFilter(key: MultiFilterKey) {
    const field = multiFilterFields.find((f) => f.key === key)!
    return (
      <div key={key} className="space-y-2">
        <Label>{field.label}</Label>
        <MultiSelect
          items={field.items}
          value={multiFilters[key]}
          onValueChange={setMultiFilter(key)}
          placeholder={field.items.length ? "Todos" : "Nenhum no período"}
          searchPlaceholder={`Buscar ${field.label.toLowerCase()}...`}
          disabled={field.items.length === 0 && multiFilters[key].length === 0}
        />
      </div>
    )
  }

  const filterPanel = (
    <DataTableFilterPanel onApply={applyFilters} onClear={clearFilters}>
      {renderMultiFilter("clientId")}
      <div className="space-y-2">
        <Label>Data</Label>
        <DateRangePicker value={dateRange} onValueChange={setDateRange} placeholder="Selecione uma data ou período" />
      </div>
      <div className="space-y-2">
        <Label>Duração mínima: {formatDurationHours(Math.min(minDuration, maxDurationFilter))}h</Label>
        <Slider
          min={0}
          max={maxDurationFilter}
          step={MIN_DURATION_STEP}
          value={Math.min(minDuration, maxDurationFilter)}
          onValueChange={setMinDuration}
          className="pt-2"
        />
      </div>
      {renderMultiFilter("projectId")}
      {renderMultiFilter("analystId")}
      {renderMultiFilter("requesterId")}
      {renderMultiFilter("departmentId")}
      {renderMultiFilter("demandTypeId")}
      {renderMultiFilter("priority")}
      {renderMultiFilter("status")}
      {renderMultiFilter("tagId")}
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Demandas" description="Gerenciar demandas">
        <PeriodSelect years={years} monthsByYear={monthsByYear} value={period} onChange={setPeriod} />
      </PageHeader>

      <DataTable
        refreshing={isPending || isPeriodPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por qualquer informação..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={
          <>
            {canCreate && newDialog}
            <DemandExportDialog clients={filterOptions.clients} years={years} monthsByYear={monthsByYear} />
            {canCreate && (
              <DemandImportDialog
                clients={clients}
                analysts={analysts}
                requesters={requesters}
                departments={departments}
                demandTypes={demandTypes}
              />
            )}
          </>
        }
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        footer={<TotalsByClientSummary totals={totalsByClient} />}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteDemands,
          onSuccess: () => refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Demanda"
        description="Tem certeza que deseja excluir esta demanda? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
