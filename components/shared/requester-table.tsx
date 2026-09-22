"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { TruncatedText } from "@/components/shared/truncated-text"
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
import { deleteRequester, createRequester, updateRequester, bulkDeleteRequesters, setRequesterStatus } from "@/actions/requesters"
import { createRequesterSchema, updateRequesterSchema, type CreateRequesterInput } from "@/schemas/requester.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { Requester } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface RequesterTableProps {
  data: Requester[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["name", "email", "phone", "status"]

export function RequesterTable({ data, meta }: RequesterTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    handleToggleStatus,
    sort,
    onSortChange,
  } = useCrudTable<Requester>({
    deleteAction: deleteRequester,
    setStatusAction: setRequesterStatus,
    deleteSuccessMessage: "Solicitante excluído com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const canCreate = useHasPermission("requesters", "create")
  const canUpdate = useHasPermission("requesters", "update")
  const canDelete = useHasPermission("requesters", "delete")
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  const form = useForm<CreateRequesterInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateRequesterSchema : createRequesterSchema) as Resolver<CreateRequesterInput>,
    values: editDialog.entity
      ? { name: editDialog.entity.name, email: editDialog.entity.email || "", phone: editDialog.entity.phone || "", status: editDialog.entity.status }
      : { name: "", email: "", phone: "", status: true },
  })

  async function onSubmit(data: CreateRequesterInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateRequester(editDialog.entity.id, formData)
      : await createRequester(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Solicitante atualizado" : "Solicitante criado")
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

  const columns: ColumnDef<Requester>[] = useMemo(() => {
    const columns: ColumnDef<Requester>[] = [
    createSelectColumn<Requester>(),
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as boolean
        return <Badge variant={status ? "success" : "destructive"}>{status ? "Ativo" : "Inativo"}</Badge>
      },
    },
    { accessorKey: "name", header: "Nome", cell: ({ row }) => <TruncatedText text={row.original.name} /> },
    { accessorKey: "email", header: "E-mail", cell: ({ row }) => row.getValue("email") || "-" },
    { accessorKey: "phone", header: "Telefone", cell: ({ row }) => row.getValue("phone") || "-" },
  ]

  const actionsColumn: ColumnDef<Requester> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        onToggleStatus={canUpdate ? () => handleToggleStatus(row.original.id, row.original.status) : undefined}
        isActive={row.original.status}
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog, handleToggleStatus])

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Solicitante</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Solicitante" : "Novo Solicitante"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox id="status" checked={field.value ?? true} onCheckedChange={(v) => field.onChange(!!v)} />
              )}
            />
            <Label htmlFor="status">Solicitante ativo</Label>
          </div>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do solicitante" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="email">E-mail</FieldLabel>
            <Input id="email" type="email" {...form.register("email")} placeholder="email@exemplo.com (opcional)" aria-invalid={!!form.formState.errors.email} />
            <FieldError errors={[form.formState.errors.email]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="phone">Telefone</FieldLabel>
            <Input id="phone" {...form.register("phone")} placeholder="(00) 00000-0000 (opcional)" aria-invalid={!!form.formState.errors.phone} />
            <FieldError errors={[form.formState.errors.phone]} />
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
      <PageHeader title="Solicitantes" description="Gerenciar solicitantes de demandas" />

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
        toolbarActions={canCreate ? newDialog : undefined}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteRequesters,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Solicitante"
        description="Tem certeza que deseja excluir este solicitante? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
