"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { deleteDataserver, restoreDataserver, createDataserver, updateDataserver } from "@/actions/admin/dataservers"
import { createDataserverSchema, updateDataserverSchema, type CreateDataserverInput } from "@/schemas/dataserver.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Dataserver } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface DataserverTableProps {
  data: Dataserver[]
  meta: PaginationMeta
}

export function DataserverTable({ data, meta }: DataserverTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<Dataserver>({
    deleteAction: deleteDataserver,
    restoreAction: restoreDataserver,
    deleteSuccessMessage: "Dataserver excluído com sucesso",
    restoreSuccessMessage: "Dataserver restaurado com sucesso",
  })
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateDataserverInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDataserverSchema : createDataserverSchema) as Resolver<CreateDataserverInput>,
    values: editDialog.entity
      ? { code: editDialog.entity.code, nameAlternative: editDialog.entity.nameAlternative || "", name: editDialog.entity.name }
      : { code: "", nameAlternative: "", name: "" },
  })

  async function onSubmit(data: CreateDataserverInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateDataserver(editDialog.entity.id, formData)
      : await createDataserver(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Dataserver atualizado" : "Dataserver criado")
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

  const columns: ColumnDef<Dataserver>[] = [
    createSelectColumn<Dataserver>(),
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "nameAlternative",
      header: "Nome Alternativo",
      cell: ({ row }) => row.getValue("nameAlternative") || "-",
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
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Dataserver</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Dataserver" : "Novo Dataserver"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input id="code" {...form.register("code")} placeholder="Código único" aria-invalid={!!form.formState.errors.code} />
            <FieldError errors={[form.formState.errors.code]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do dataserver" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="nameAlternative">Nome Alternativo</FieldLabel>
            <Input id="nameAlternative" {...form.register("nameAlternative")} placeholder="Nome alternativo (opcional)" />
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
      <PageHeader title="Dataservers" description="Gerenciar dataservers" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por código ou nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Dataserver"
        description="Tem certeza que deseja excluir este dataserver? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
