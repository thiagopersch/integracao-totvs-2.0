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
import { deleteContract, createContract, updateContract, bulkDeleteContracts } from "@/actions/contracts"
import { createContractSchema, updateContractSchema, type CreateContractInput } from "@/schemas/contract.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Client } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

type ContractRow = {
  id: string
  contractedHours: number
  hourlyRate: number
  startDate: string | Date
  endDate: string | Date | null
  status: string
  notes: string | null
  client: { id: string; name: string; color: string }
}

interface ContractTableProps {
  data: ContractRow[]
  meta: PaginationMeta
  clients: Client[]
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Ativo",
  SUSPENDED: "Suspenso",
  EXPIRED: "Expirado",
  CANCELLED: "Cancelado",
}

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  ACTIVE: "default",
  SUSPENDED: "secondary",
  EXPIRED: "outline",
  CANCELLED: "destructive",
}

export function ContractTable({ data, meta, clients }: ContractTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<ContractRow>({
    deleteAction: deleteContract,
    deleteSuccessMessage: "Contrato excluído com sucesso",
  })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  function toDateInputValue(d: string | Date) {
    const date = typeof d === "string" ? new Date(d) : d
    return date.toISOString().slice(0, 10)
  }

  const form = useForm<CreateContractInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateContractSchema : createContractSchema) as Resolver<CreateContractInput>,
    values: editDialog.entity
      ? {
          clientId: editDialog.entity.client.id,
          contractedHours: editDialog.entity.contractedHours,
          hourlyRate: editDialog.entity.hourlyRate,
          startDate: toDateInputValue(editDialog.entity.startDate),
          endDate: editDialog.entity.endDate ? toDateInputValue(editDialog.entity.endDate) : "",
          status: editDialog.entity.status as CreateContractInput["status"],
          notes: editDialog.entity.notes || "",
        }
      : {
          clientId: "",
          contractedHours: 40,
          hourlyRate: 0,
          startDate: new Date().toISOString().slice(0, 10),
          endDate: "",
          status: "ACTIVE",
          notes: "",
        },
  })

  async function onSubmit(data: CreateContractInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateContract(editDialog.entity.id, formData)
      : await createContract(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Contrato atualizado" : "Contrato criado")
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

  const columns: ColumnDef<ContractRow>[] = [
    createSelectColumn<ContractRow>(),
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.original.client.color }} />
          {row.original.client.name}
        </div>
      ),
    },
    { accessorKey: "contractedHours", header: "Horas Contratadas" },
    {
      accessorKey: "hourlyRate",
      header: "Valor/hora",
      cell: ({ row }) => (row.getValue("hourlyRate") as number).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    },
    {
      accessorKey: "startDate",
      header: "Início",
      cell: ({ row }) => new Date(row.getValue("startDate")).toLocaleDateString("pt-BR"),
    },
    {
      accessorKey: "endDate",
      header: "Término",
      cell: ({ row }) => {
        const endDate = row.getValue("endDate") as string | Date | null
        return endDate ? new Date(endDate).toLocaleDateString("pt-BR") : "-"
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as string
        return <Badge variant={STATUS_VARIANTS[status] || "secondary"}>{STATUS_LABELS[status] || status}</Badge>
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
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Contrato</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Contrato" : "Novo Contrato"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
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
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="contractedHours">Horas Contratadas</FieldLabel>
              <Input id="contractedHours" type="number" min={1} {...form.register("contractedHours")} aria-invalid={!!form.formState.errors.contractedHours} />
              <FieldError errors={[form.formState.errors.contractedHours]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="hourlyRate">Valor/hora</FieldLabel>
              <Input id="hourlyRate" type="number" step="0.01" min={0} {...form.register("hourlyRate")} placeholder="0.00" aria-invalid={!!form.formState.errors.hourlyRate} />
              <FieldError errors={[form.formState.errors.hourlyRate]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="startDate">Início</FieldLabel>
              <Input id="startDate" type="date" {...form.register("startDate")} aria-invalid={!!form.formState.errors.startDate} />
              <FieldError errors={[form.formState.errors.startDate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="endDate">Término (opcional)</FieldLabel>
              <Input id="endDate" type="date" {...form.register("endDate")} aria-invalid={!!form.formState.errors.endDate} />
              <FieldError errors={[form.formState.errors.endDate]} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="status">Status</FieldLabel>
            <Select
              items={Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))}
              value={form.watch("status") || "ACTIVE"}
              onValueChange={(v) => form.setValue("status", v as CreateContractInput["status"] || "ACTIVE")}
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
            <FieldLabel htmlFor="notes">Observações</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Observações (opcional)" aria-invalid={!!form.formState.errors.notes} />
            <FieldError errors={[form.formState.errors.notes]} />
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
      <PageHeader title="Contratos" description="Gerenciar contratos de clientes" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por cliente..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.client.name,
          action: bulkDeleteContracts,
          confirmDescription: (count) => `Tem certeza que deseja excluir ${count} contrato(s) selecionado(s)? Esta ação não pode ser desfeita.`,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Contrato"
        description="Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
