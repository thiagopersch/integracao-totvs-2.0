"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
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
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
import { deleteAnalyst, createAnalyst, updateAnalyst, bulkDeleteAnalysts } from "@/actions/analysts"
import { createAnalystSchema, updateAnalystSchema, type CreateAnalystInput } from "@/schemas/analyst.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Analyst } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface AnalystTableProps {
  data: Analyst[]
  meta: PaginationMeta
}

export function AnalystTable({ data, meta }: AnalystTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<Analyst>({
    deleteAction: deleteAnalyst,
    deleteSuccessMessage: "Analista excluído com sucesso",
  })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  const form = useForm<CreateAnalystInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateAnalystSchema : createAnalystSchema) as Resolver<CreateAnalystInput>,
    values: editDialog.entity
      ? {
          name: editDialog.entity.name,
          email: editDialog.entity.email || "",
          phone: editDialog.entity.phone || "",
          role: editDialog.entity.role || "",
          hourlyRate: editDialog.entity.hourlyRate ?? undefined,
          team: editDialog.entity.team || "",
          color: editDialog.entity.color,
          level: editDialog.entity.level,
          status: editDialog.entity.status,
        }
      : { name: "", email: "", phone: "", role: "", hourlyRate: undefined, team: "", color: "#6366f1", level: 1, status: true },
  })

  async function onSubmit(data: CreateAnalystInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateAnalyst(editDialog.entity.id, formData)
      : await createAnalyst(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Analista atualizado" : "Analista criado")
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

  const columns: ColumnDef<Analyst>[] = [
    createSelectColumn<Analyst>(),
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.original.color }} />
          {row.original.name}
        </div>
      ),
    },
    { accessorKey: "role", header: "Cargo", cell: ({ row }) => row.getValue("role") || "-" },
    { accessorKey: "team", header: "Time", cell: ({ row }) => row.getValue("team") || "-" },
    { accessorKey: "level", header: "Nível" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as boolean
        return <Badge variant={status ? "default" : "secondary"}>{status ? "Ativo" : "Inativo"}</Badge>
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
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Analista</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Analista" : "Novo Analista"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do analista" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} placeholder="email@exemplo.com" aria-invalid={!!form.formState.errors.email} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefone</FieldLabel>
              <Input id="phone" {...form.register("phone")} placeholder="(00) 00000-0000" aria-invalid={!!form.formState.errors.phone} />
              <FieldError errors={[form.formState.errors.phone]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="role">Cargo</FieldLabel>
              <Input id="role" {...form.register("role")} placeholder="Ex: Analista" />
            </Field>
            <Field>
              <FieldLabel htmlFor="team">Time</FieldLabel>
              <Input id="team" {...form.register("team")} placeholder="Ex: Suporte" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="hourlyRate">Valor/hora</FieldLabel>
              <Input id="hourlyRate" type="number" step="0.01" {...form.register("hourlyRate")} placeholder="0.00" aria-invalid={!!form.formState.errors.hourlyRate} />
              <FieldError errors={[form.formState.errors.hourlyRate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="level">Nível</FieldLabel>
              <Input id="level" type="number" min={1} {...form.register("level")} aria-invalid={!!form.formState.errors.level} />
              <FieldError errors={[form.formState.errors.level]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="color">Cor</FieldLabel>
              <Input id="color" type="color" className="h-9 w-full p-1" {...form.register("color")} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox id="status" checked={field.value ?? true} onCheckedChange={(v) => field.onChange(!!v)} />
              )}
            />
            <Label htmlFor="status">Analista ativo</Label>
          </div>
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
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Ativo" },
            { value: "false", label: "Inativo" },
          ]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Analistas" description="Gerenciar analistas" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome ou e-mail..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteAnalysts,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Analista"
        description="Tem certeza que deseja excluir este analista? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
