"use client"

import { useMemo, useState } from "react"
import dynamic from "next/dynamic"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelect, type MultiSelectItem } from "@/components/ui/multi-select"
import { Slider } from "@/components/ui/slider"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { format, parse } from "date-fns"
import type { DateRange } from "react-day-picker"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Plus, Loader2, Maximize2, Minimize2, Copy } from "lucide-react"
import { deleteDemand, createDemand, updateDemand, duplicateDemand, bulkDeleteDemands, type getDemandFilterOptions } from "@/actions/demands"
import { createDemandSchema, updateDemandSchema, timeToMinutes, type CreateDemandInput } from "@/schemas/demand.schema"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import { TruncatedText } from "@/components/shared/truncated-text"
import "@uiw/react-md-editor/markdown-editor.css"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { usePeriodFilter } from "@/hooks/use-period-filter"
import { PeriodSelect } from "@/components/shared/period-select"
import { TotalsByClientSummary } from "@/components/shared/totals-by-client-summary"
import { DemandExportDialog } from "@/components/shared/demand-export-dialog"
import { DemandImportDialog } from "@/components/shared/demand-import-dialog"
import type { Analyst, Client, Requester, Department, DemandType, Tag } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"
import type { Period } from "@/lib/period"
import { WithTooltip } from "@/components/shared/with-tooltip"

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
  filterOptions: Awaited<ReturnType<typeof getDemandFilterOptions>>
  requesters: Requester[]
  departments: Department[]
  demandTypes: DemandType[]
  tags: Tag[]
  totalsByClient: { clientId: string; clientName: string; clientColor: string; hours: number }[]
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

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  date: "Data",
  startTime: "Hora de início",
  endTime: "Hora de término",
  analystId: "Analista",
  clientId: "Cliente",
  requesterId: "Solicitante",
  departmentId: "Departamento",
  demandTypeId: "Tipo",
}

const FIELD_TAB: Record<string, string> = {
  name: "identificacao",
  description: "identificacao",
  analystId: "atribuicao",
  clientId: "atribuicao",
  requesterId: "atribuicao",
  departmentId: "atribuicao",
  demandTypeId: "atribuicao",
  date: "agendamento",
  startTime: "agendamento",
  endTime: "agendamento",
  priority: "agendamento",
  status: "agendamento",
  tagIds: "tags",
  notes: "tags",
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

/** Multi-select filters, keyed by their URL param (comma-separated ids/enum values). */
const MULTI_FILTER_KEYS = ["clientId", "analystId", "requesterId", "departmentId", "demandTypeId", "priority", "status", "tagId"] as const
type MultiFilterKey = (typeof MULTI_FILTER_KEYS)[number]

const MIN_DURATION_STEP = 15
const MIN_DURATION_FLOOR_MAX = 8 * 60

function parseDayParam(value: string | null): Date | undefined {
  return value ? parse(value, "yyyy-MM-dd", new Date()) : undefined
}
const VISIBLE_TAGS = 2

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
  const [loading, setLoading] = useState(false)
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
  const [expanded, setExpanded] = useState(false)
  const [activeTab, setActiveTab] = useState("identificacao")
  const { period, setPeriod, isPending: isPeriodPending } = usePeriodFilter(initialPeriod)

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
          notes: editDialog.entity.notes ?? "",
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
      setActiveTab("identificacao")
      refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
    setActiveTab("identificacao")
  }

  function onInvalid(errors: FieldErrors<CreateDemandInput>) {
    const missing = Object.keys(errors).map((key) => FIELD_LABELS[key] || key)
    if (missing.length > 0) {
      toast.error(
        missing.length === 1
          ? `Preencha o campo obrigatório: ${missing[0]}`
          : `Preencha os campos obrigatórios: ${missing.join(", ")}`
      )
    }
    const firstErrorField = Object.keys(errors)[0]
    const tab = firstErrorField && FIELD_TAB[firstErrorField]
    if (tab) setActiveTab(tab)
  }

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
        setActiveTab("identificacao")
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
      cell: ({ row }) =>
        row.original.analyst ? <ColorBadge label={row.original.analyst.name} color={row.original.analyst.color} /> : "-",
    },
    { id: "requester", header: "Solicitante", cell: ({ row }) => row.original.requester?.name || "-" },
    { id: "department", header: "Departamento", cell: ({ row }) => row.original.department?.name || "-" },
    {
      id: "demandType",
      header: "Tipo",
      cell: ({ row }) =>
        row.original.demandType ? <ColorBadge label={row.original.demandType.name} color={row.original.demandType.color} /> : "-",
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
                <TooltipContent variant="surface">
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
  ]

  const actionsColumn: ColumnDef<DemandRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => { setActiveTab("identificacao"); setEditDialog({ open: true, entity: row.original }) } : undefined}
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
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) { form.reset(); setExpanded(false); setActiveTab("identificacao") } }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Nova Demanda</Button>} />
      <DialogContent
        className={expanded ? "h-[99vh]! max-h-[99vh]! w-[99vw]! max-w-[99vw]!" : undefined}
        headerActions={
          <WithTooltip label={expanded ? "Tamanho normal" : "Expandir"}>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded((v) => !v)}
              aria-label={expanded ? "Tamanho normal" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </WithTooltip>
        }
      >
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Demanda" : "Nova Demanda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
          <TabsList className="w-full">
            <TabsTrigger value="identificacao" className="flex-1">Identificação</TabsTrigger>
            <TabsTrigger value="atribuicao" className="flex-1">Atribuição</TabsTrigger>
            <TabsTrigger value="agendamento" className="flex-1">Agendamento</TabsTrigger>
            <TabsTrigger value="tags" className="flex-1">Tags e Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="identificacao" className="mt-4 space-y-4">
          <Field>
            <FieldLabel htmlFor="name">Nome da demanda</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome da demanda" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Controller
              control={form.control}
              name="description"
              render={({ field }) => (
                <div className="max-h-[260px] overflow-y-auto rounded-md border border-input" data-color-mode="auto">
                  <MDEditor
                    value={field.value}
                    onChange={(v) => field.onChange(v || "")}
                    height={260}
                    preview="live"
                    visibleDragbar={false}
                  />
                </div>
              )}
            />
            <FieldError errors={[form.formState.errors.description]} />
          </Field>
          </TabsContent>

          <TabsContent value="atribuicao" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="analystId">Analista</FieldLabel>
              <Select
                items={analysts.map((a) => ({ value: a.id, label: a.name }))}
                value={form.watch("analystId") || null}
                onValueChange={(v) => form.setValue("analystId", v || "", { shouldValidate: true })}
              >
                <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.analystId}>
                  <SelectValue placeholder="Selecione um analista">
                    {(value: string) => {
                      const analyst = analysts.find((a) => a.id === value)
                      return analyst ? <ColorBadge label={analyst.name} color={analyst.color} /> : "Selecione um analista"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {analysts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <ColorBadge label={a.name} color={a.color} />
                    </SelectItem>
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
                  <SelectValue placeholder="Selecione um cliente">
                    {(value: string) => {
                      const client = clients.find((c) => c.id === value)
                      return client ? <ColorBadge label={client.name} color={client.color} solid /> : "Selecione um cliente"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      <ColorBadge label={c.name} color={c.color} solid />
                    </SelectItem>
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

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                  <SelectValue placeholder="Selecione um tipo">
                    {(value: string) => {
                      const demandType = demandTypes.find((d) => d.id === value)
                      return demandType ? <ColorBadge label={demandType.name} color={demandType.color} /> : "Selecione um tipo"
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {demandTypes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      <ColorBadge label={d.name} color={d.color} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError errors={[form.formState.errors.demandTypeId]} />
            </Field>
          </div>
          </TabsContent>

          <TabsContent value="agendamento" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
                  <SelectValue>
                    {(value: string) =>
                      value ? <ColorBadge label={PRIORITY_LABELS[value]} color={PRIORITY_COLORS[value]} /> : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <ColorBadge label={label} color={PRIORITY_COLORS[value]} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="status">Status</FieldLabel>
              <Select
                items={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                value={form.watch("status") || "PENDING"}
                onValueChange={(v) => form.setValue("status", v || "PENDING")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {(value: string) =>
                      value ? <ColorBadge label={STATUS_LABELS[value]} color={STATUS_COLORS[value]} /> : "Selecione"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      <ColorBadge label={label} color={STATUS_COLORS[value]} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          </TabsContent>

          <TabsContent value="tags" className="mt-4 space-y-4">
          <Field>
            <FieldLabel htmlFor="tagIds">Tags</FieldLabel>
            <MultiSelect
              items={tags.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color }))}
              value={selectedTagIds}
              onValueChange={(v) => form.setValue("tagIds", v)}
              placeholder="Selecione as tags"
              searchPlaceholder="Buscar tag..."
              emptyText="Nenhuma tag encontrada."
              disabled={tags.length === 0}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="notes">Notas</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Notas adicionais (opcional)" />
          </Field>
          </TabsContent>
        </Tabs>
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
    { key: "analystId", label: "Analista", items: filterOptions.analysts.map((a) => ({ value: a.id, label: a.name, color: a.color })) },
    { key: "requesterId", label: "Solicitante", items: filterOptions.requesters.map((r) => ({ value: r.id, label: r.name })) },
    { key: "departmentId", label: "Departamento", items: filterOptions.departments.map((d) => ({ value: d.id, label: d.name })) },
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
