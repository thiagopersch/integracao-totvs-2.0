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
import { Plus, Loader2 } from "lucide-react"
import { deleteDemand, createDemand, updateDemand, bulkDeleteDemands } from "@/actions/demands"
import { createDemandSchema, updateDemandSchema, type CreateDemandInput } from "@/schemas/demand.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Analyst, Client, Requester, Department, DemandType, Tag } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

type DemandRow = {
  id: string
  name: string
  description: string
  date: string | Date
  durationMinutes: number
  priority: string
  status: string
  analyst: { id: string; name: string; color: string } | null
  client: { id: string; name: string; color: string } | null
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
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  PENDING: "secondary",
  IN_PROGRESS: "default",
  COMPLETED: "outline",
  CANCELLED: "destructive",
}

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baixa",
  MEDIUM: "Média",
  HIGH: "Alta",
  URGENT: "Urgente",
}

const SORTABLE_COLUMNS = ["name", "date", "priority", "status"]

export function DemandTable({ data, meta, analysts, clients, requesters, departments, demandTypes, tags }: DemandTableProps) {
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

  function toDateInputValue(d: string | Date) {
    const date = typeof d === "string" ? new Date(d) : d
    return date.toISOString().slice(0, 10)
  }

  const form = useForm<CreateDemandInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDemandSchema : createDemandSchema) as Resolver<CreateDemandInput>,
    values: editDialog.entity
      ? {
          name: editDialog.entity.name,
          description: editDialog.entity.description,
          date: toDateInputValue(editDialog.entity.date),
          durationMinutes: editDialog.entity.durationMinutes,
          priority: editDialog.entity.priority,
          status: editDialog.entity.status,
          notes: "",
          analystId: editDialog.entity.analyst?.id || "",
          clientId: editDialog.entity.client?.id || "",
          requesterId: "",
          departmentId: "",
          demandTypeId: editDialog.entity.demandType?.id || "",
          tagIds: editDialog.entity.demandTags.map((dt) => dt.tag.id),
        } as CreateDemandInput
      : {
          name: "",
          description: "",
          date: new Date().toISOString().slice(0, 10),
          durationMinutes: 60,
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
    { accessorKey: "name", header: "Nome" },
    { id: "analyst", header: "Analista", cell: ({ row }) => row.original.analyst?.name || "-" },
    { id: "client", header: "Cliente", cell: ({ row }) => row.original.client?.name || "-" },
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => new Date(row.getValue("date") as string).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    },
    {
      accessorKey: "priority",
      header: "Prioridade",
      cell: ({ row }) => <Badge variant="outline">{PRIORITY_LABELS[row.getValue("priority") as string]}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return <Badge variant={STATUS_VARIANTS[status]}>{STATUS_LABELS[status]}</Badge>
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
            <FieldLabel htmlFor="name">Nome</FieldLabel>
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
                onValueChange={(v) => form.setValue("analystId", v || "")}
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
                onValueChange={(v) => form.setValue("clientId", v || "")}
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
                onValueChange={(v) => form.setValue("requesterId", v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {requesters.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="departmentId">Departamento</FieldLabel>
              <Select
                items={departments.map((d) => ({ value: d.id, label: d.name }))}
                value={form.watch("departmentId") || null}
                onValueChange={(v) => form.setValue("departmentId", v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="demandTypeId">Tipo</FieldLabel>
              <Select
                items={demandTypes.map((d) => ({ value: d.id, label: d.name }))}
                value={form.watch("demandTypeId") || null}
                onValueChange={(v) => form.setValue("demandTypeId", v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {demandTypes.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="date">Data</FieldLabel>
              <Input id="date" type="date" {...form.register("date")} aria-invalid={!!form.formState.errors.date} />
              <FieldError errors={[form.formState.errors.date]} />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="durationMinutes">Duração (minutos)</FieldLabel>
              <Input id="durationMinutes" type="number" min={1} {...form.register("durationMinutes")} aria-invalid={!!form.formState.errors.durationMinutes} />
              <FieldError errors={[form.formState.errors.durationMinutes]} />
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
          </div>

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
