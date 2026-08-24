"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
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
import { deleteDepartment, createDepartment, updateDepartment } from "@/actions/departments"
import { createDepartmentSchema, updateDepartmentSchema, type CreateDepartmentInput } from "@/schemas/department.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Department } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface DepartmentTableProps {
  data: Department[]
  meta: PaginationMeta
}

export function DepartmentTable({ data, meta }: DepartmentTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<Department>({
    deleteAction: deleteDepartment,
    deleteSuccessMessage: "Departamento excluído com sucesso",
  })
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateDepartmentInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDepartmentSchema : createDepartmentSchema) as Resolver<CreateDepartmentInput>,
    values: editDialog.entity
      ? { name: editDialog.entity.name, description: editDialog.entity.description || "" }
      : { name: "", description: "" },
  })

  async function onSubmit(data: CreateDepartmentInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateDepartment(editDialog.entity.id, formData)
      : await createDepartment(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Departamento atualizado" : "Departamento criado")
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

  const columns: ColumnDef<Department>[] = [
    { accessorKey: "name", header: "Nome" },
    { accessorKey: "description", header: "Descrição", cell: ({ row }) => row.getValue("description") || "-" },
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
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Departamento</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do departamento" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Textarea id="description" {...form.register("description")} placeholder="Descrição (opcional)" />
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

  return (
    <>
      <PageHeader title="Departamentos" description="Gerenciar departamentos" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Departamento"
        description="Tem certeza que deseja excluir este departamento? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
