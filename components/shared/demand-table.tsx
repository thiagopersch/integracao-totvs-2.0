"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MoreHorizontal, Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import { deleteDemand, createDemand, updateDemand } from "@/actions/demands"
import { listAllAnalysts } from "@/actions/analysts"
import { listAllClients } from "@/actions/admin/clients"
import { listAllRequesters } from "@/actions/requesters"
import { listAllDepartments } from "@/actions/departments"
import { listAllDemandTypes } from "@/actions/demand-types"
import { listAllTags } from "@/actions/tags"
import { createDemandSchema, updateDemandSchema } from "@/schemas/demand.schema"
import { toast } from "sonner"
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

export function DemandTable({ data, meta }: DemandTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; demand?: DemandRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [analysts, setAnalysts] = useState<Analyst[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [requesters, setRequesters] = useState<Requester[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [demandTypes, setDemandTypes] = useState<DemandType[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  useEffect(() => {
    listAllAnalysts().then(setAnalysts)
    listAllClients().then(setClients)
    listAllRequesters().then(setRequesters)
    listAllDepartments().then(setDepartments)
    listAllDemandTypes().then(setDemandTypes)
    listAllTags().then(setTags)
  }, [])

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  function toDateInputValue(d: string | Date) {
    const date = typeof d === "string" ? new Date(d) : d
    return date.toISOString().slice(0, 10)
  }

  const form = useForm<any>({
    resolver: zodResolver(editDialog.demand ? updateDemandSchema : createDemandSchema),
    values: editDialog.demand
      ? {
          name: editDialog.demand.name,
          description: editDialog.demand.description,
          date: toDateInputValue(editDialog.demand.date),
          durationMinutes: editDialog.demand.durationMinutes,
          priority: editDialog.demand.priority,
          status: editDialog.demand.status,
          notes: "",
          analystId: editDialog.demand.analyst?.id || "",
          clientId: editDialog.demand.client?.id || "",
          requesterId: "",
          departmentId: "",
          demandTypeId: editDialog.demand.demandType?.id || "",
          tagIds: editDialog.demand.demandTags.map((dt) => dt.tag.id),
        }
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

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === "tagIds") return
      if (value !== undefined) formData.append(key, String(value))
    })
    for (const tagId of data.tagIds || []) formData.append("tagIds", tagId)

    const result = editDialog.demand
      ? await updateDemand(editDialog.demand.id, formData)
      : await createDemand(formData)

    if (result.success) {
      toast.success(editDialog.demand ? "Demanda atualizada" : "Demanda criada")
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

  async function handleDelete(id: string) {
    const result = await deleteDemand(id)
    if (result.success) {
      toast.success("Demanda excluída com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  const columns: ColumnDef<DemandRow>[] = [
    { accessorKey: "name", header: "Nome" },
    { id: "analyst", header: "Analista", cell: ({ row }) => row.original.analyst?.name || "-" },
    { id: "client", header: "Cliente", cell: ({ row }) => row.original.client?.name || "-" },
    {
      accessorKey: "date",
      header: "Data",
      cell: ({ row }) => new Date(row.getValue("date") as string).toLocaleDateString("pt-BR"),
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, demand: row.original })}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteDialog({ open: true, id: row.original.id })}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, demand: open ? editDialog.demand : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Nova Demanda
      </DialogTrigger>
      <DialogContent className="flex w-[70vw] min-w-[70vw] max-w-[70vw] h-[80vh] min-h-[80vh] max-h-[80vh] flex-col sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{editDialog.demand ? "Editar Demanda" : "Nova Demanda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto pr-1">
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

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
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
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}>
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
