"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { Plus, Loader2 } from "lucide-react"
import { deleteDemand, createDemand, updateDemand, bulkDeleteDemands } from "@/actions/demands"
import { createDemandSchema, updateDemandSchema, timeToMinutes, type CreateDemandInput } from "@/schemas/demand.schema"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import { TruncatedText } from "@/components/shared/truncated-text"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { usePeriodFilter } from "@/hooks/use-period-filter"
import { PeriodSelect } from "@/components/shared/period-select"
import { TotalsByClientSummary } from "@/components/shared/totals-by-client-summary"
import type { Analyst, Client, Requester, Department, DemandType, Tag } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"
import type { Period } from "@/lib/period"

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
  analyst: { id: string; name: string; color: string } | null
  client: { id: string; name: string; color: string } | null
  requester: { id: string; name: string } | null
  department: { id: string; name: string } | null
  demandType: { id: string; name: string; color: string } | null
  demandTags: { tag: Tag }[]
}

interface DemandTableProps {
  data: DemandRow[]
  meta: PaginationMeta
  analysts: Analyst[]
  clients: Client[]
  requesters: Requester[]
  departments: Department[]
  demandTypes: DemandType[]
  tags: Tag[]
  totalsByClient: { clientId: string; clientName: string; hours: number }[]
  period: Period | null
  years: number[]
  monthsByYear: Record<number, number[]>
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

function ColorBadge({ label, color }: { label: string; color: string }) {
  return (
    <Badge style={{ backgroundColor: `${color}22`, borderColor: color, color }} variant="outline">
      {label}
    </Badge>
  )
}

function toTimeInputValue(d: string | Date | null): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  const hours = String(date.getUTCHours()).padStart(2, "0")
  const minutes = String(date.getUTCMinutes()).padStart(2, "0")
  return `${hours}:${minutes}`
}

function formatDurationHours(minutes: number): string {
  return (minutes / 60).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const SORTABLE_COLUMNS = ["name", "date", "priority", "status"]
const VISIBLE_TAGS = 2

export function DemandTable({
  data,
  meta,
  analysts,
  clients,
  requesters,
  departments,
  demandTypes,
  tags,
  totalsByClient,
  period: initialPeriod,
  years,
  monthsByYear,
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
  } = useCrudTable<DemandRow>({
    deleteAction: deleteDemand,
    deleteSuccessMessage: "Demanda excluída com sucesso",
    defaultSort: { field: "date", direction: "desc" },
  })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const { period, setPeriod } = usePeriodFilter(initialPeriod)

  const form = useForm<CreateDemandInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDemandSchema : createDemandSchema) as Resolver<CreateDemandInput>,
    values: editDialog.entity
      ? {
          name: editDialog.entity.name,
          description: editDialog.entity.description,
          date: toDateInputValue(editDialog.entity.date),
          startTime: toTimeInputValue(editDialog.entity.startTime),
          endTime: toTimeInputValue(editDialog.entity.endTime),
          priority: editDialog.entity.priority,
          status: editDialog.entity.status,
          notes: "",
          analystId: editDialog.entity.analyst?.id || "",
          clientId: editDialog.entity.client?.id || "",
          requesterId: editDialog.entity.requester?.id || "",
          departmentId: editDialog.entity.department?.id || "",
          demandTypeId: editDialog.entity.demandType?.id || "",
          tagIds: editDialog.entity.demandTags.map((dt) => dt.tag.id),
        } as CreateDemandInput
      : {
          name: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
          startTime: "08:00",
          endTime: "09:00",
          priority: "MEDIUM",
          status: "PENDING",
          notes: "",
          analystId: "",
          clientId: "",
          requesterId: "",
          departmentId: "",
          demandTypeId: "",
          tagIds: [],
        },
  })

  const selectedTagIds: string[] = form.watch("tagIds") || []
  const watchedStartTime = form.watch("startTime")
  const watchedEndTime = form.watch("endTime")
  const previewMinutes =
    watchedStartTime && watchedEndTime && timeToMinutes(watchedEndTime) > timeToMinutes(watchedStartTime)
      ? timeToMinutes(watchedEndTime) - timeToMinutes(watchedStartTime)
      : 0

  function toggleTag(tagId: string) {
    const current: string[] = form.getValues("tagIds") || []
    form.setValue("tagIds", current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId])
  }

  async function onSubmit(data: CreateDemandInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === "tagIds") return
      if (value !== undefined) formData.append(key, String(value))
    })
    for (const tagId of data.tagIds || []) formData.append("tagIds", tagId)

    const result = editDialog.entity
      ? await updateDemand(editDialog.entity.id, formData)
      : await createDemand(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Demanda atualizada" : "Demanda criada")
      form.reset()
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<DemandRow>[] = [
    createSelectColumn<DemandRow>(),
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <TruncatedText text={row.original.name} />,
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => <TruncatedText text={row.original.description} />,
    },
    { id: "analyst", header: "Analista", cell: ({ row }) => row.original.analyst?.name || "-" },
    { id: "client", header: "Cliente", cell: ({ row }) => row.original.client?.name || "-" },
    { id: "requester", header: "Solicitante", cell: ({ row }) => row.original.requester?.name || "-" },
    { id: "department", header: "Departamento", cell: ({ row }) => row.original.department?.name || "-" },
    {
      id: "demandType",
      header: "Tipo",
      cell: ({ row }) =>
        row.original.demandType ? <ColorBadge label={row.original.demandType.name} color={row.original.demandType.color} /> : "-",
    },
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => formatDateOnly(row.getValue("date") as string),
    },
    {
      accessorKey: "durationMinutes",
      header: "Duração (h)",
      cell: ({ row }) => `${formatDurationHours(row.getValue("durationMinutes") as number)}h`,
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
      cell: ({ row }) => {
        const demandTags = row.original.demandTags
        if (demandTags.length === 0) return "-"
        const visible = demandTags.slice(0, VISIBLE_TAGS)
        const hidden = demandTags.slice(VISIBLE_TAGS)
        return (
          <div className="flex items-center gap-1">
            {visible.map(({ tag }) => (
              <ColorBadge key={tag.id} label={tag.name} color={tag.color} />
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
                <TooltipContent>
                  <div className="flex flex-col gap-1">
                    {hidden.map(({ tag }) => (
                      <ColorBadge key={tag.id} label={tag.name} color={tag.color} />
                    ))}
                  </div>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={() => setDeleteDialog({ open: true, id: row.original.id })}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Nova Demanda</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Demanda" : "Nova Demanda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome da demanda</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome da demanda" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Textarea id="description" {...form.register("description")} placeholder="Descrição da demanda" aria-invalid={!!form.formState.errors.description} />
            <FieldError errors={[form.formState.errors.description]} />
          </Field>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="analystId">Analista</FieldLabel>
              <Select
                items={analysts.map((a) => ({ value: a.id, label: a.name }))}
                value={form.watch("analystId") || null}
                onValueChange={(v) => form.setValue("analystId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.analystId}>
                  <SelectValue placeholder="Selecione um analista" />
                </SelectTrigger>
                <SelectContent>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.analystId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
              <Select
                items={clients.map((c) => ({ value: c.id, label: c.name }))}
                value={form.watch("clientId") || null}
                onValueChange={(v) => form.setValue("clientId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.clientId}>
                  <SelectValue placeholder="Selecione um cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.clientId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="requesterId">Solicitante</FieldLabel>
              <Select
                items={requesters.map((r) => ({ value: r.id, label: r.name }))}
                value={form.watch("requesterId") || null}
                onValueChange={(v) => form.setValue("requesterId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.requesterId}>
                  <SelectValue placeholder="Selecione um solicitante" />
                </SelectTrigger>
                <SelectContent>
                  {requesters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.requesterId]} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="departmentId">Departamento</FieldLabel>
              <Select
                items={departments.map((d) => ({ value: d.id, label: d.name }))}
                value={form.watch("departmentId") || null}
                onValueChange={(v) => form.setValue("departmentId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.departmentId}>
                  <SelectValue placeholder="Selecione um departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.departmentId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="demandTypeId">Tipo</FieldLabel>
              <Select
                items={demandTypes.map((d) => ({ value: d.id, label: d.name }))}
                value={form.watch("demandTypeId") || null}
                onValueChange={(v) => form.setValue("demandTypeId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.demandTypeId}>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  {demandTypes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.demandTypeId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Data</FieldLabel>
              <DatePicker
                id="date"
                value={form.watch("date") || ""}
                onValueChange={(v) => form.setValue("date", v, { shouldValidate: true })}
                aria-invalid={!!form.formState.errors.date}
              />
              <FieldError errors={[form.formState.errors.date]} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <Field>
              <FieldLabel htmlFor="startTime">Hora de início</FieldLabel>
              <TimePicker
                id="startTime"
                value={form.watch("startTime") || ""}
                onValueChange={(v) => form.setValue("startTime", v, { shouldValidate: true })}
                aria-invalid={!!form.formState.errors.startTime}
              />
              <FieldError errors={[form.formState.errors.startTime]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endTime">Hora de término</FieldLabel>
              <TimePicker
                id="endTime"
                value={form.watch("endTime") || ""}
                onValueChange={(v) => form.setValue("endTime", v, { shouldValidate: true })}
                aria-invalid={!!form.formState.errors.endTime}
              />
              <FieldError errors={[form.formState.errors.endTime]} />
            </Field>
            <Field>
              <FieldLabel>Duração</FieldLabel>
              <Input readOnly disabled value={previewMinutes > 0 ? `${formatDurationHours(previewMinutes)}h` : "-"} />
            </Field>
            <Field>
              <FieldLabel htmlFor="priority">Prioridade</FieldLabel>
              <Select
                items={Object.entries(PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.watch("priority") || "MEDIUM"}
                onValueChange={(v) => form.setValue("priority", v || "MEDIUM")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select
              items={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              value={form.watch("status") || "PENDING"}
              onValueChange={(v) => form.setValue("status", v || "PENDING")}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Tags</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const active = selectedTagIds.includes(tag.id)
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.id)}
                    className="rounded-full border px-3 py-1 text-xs transition-colors"
                    style={
                      active
                        ? { backgroundColor: `${tag.color}22`, borderColor: tag.color, color: tag.color }
                        : { borderColor: "var(--border)" }
                    }
                  >
                    {tag.name}
                  </button>
                )
              })}
              {tags.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma tag cadastrada.</p>}
            </div>
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notas</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Notas adicionais (opcional)" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ status: statusFilter || undefined, page: 1 })}
      onClear={() => {
        setStatusFilter("")
        pushParams({ status: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Período</Label>
        <PeriodSelect years={years} monthsByYear={monthsByYear} value={period} onChange={setPeriod} />
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Demandas" description="Gerenciar demandas" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome ou descrição..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        footer={<TotalsByClientSummary totals={totalsByClient} />}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteDemands,
          onSuccess: () => router.refresh(),
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
