"use client"

import { useMemo, useState } from "react"
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
import { deleteSistema, restoreSistema, createSistema, updateSistema, bulkDeleteSistemas } from "@/actions/admin/sistemas"
import { createSistemaSchema, updateSistemaSchema, type CreateSistemaInput } from "@/schemas/sistema.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { TotvsSystem } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SistemaTableProps {
  data: TotvsSystem[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["code", "internalName", "externalName"]

export function SistemaTable({ data, meta }: SistemaTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    sort,
    onSortChange,
  } = useCrudTable<TotvsSystem>({
    deleteAction: deleteSistema,
    restoreAction: restoreSistema,
    deleteSuccessMessage: "Sistema excluído com sucesso",
    restoreSuccessMessage: "Sistema restaurado com sucesso",
    defaultSort: { field: "code", direction: "asc" },
  })
  const canCreate = useHasPermission("sistemas", "create")
  const canUpdate = useHasPermission("sistemas", "update")
  const canDelete = useHasPermission("sistemas", "delete")
  const [loading, setLoading] = useState(false)

  const form = useForm<CreateSistemaInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateSistemaSchema : createSistemaSchema) as Resolver<CreateSistemaInput>,
    values: editDialog.entity
      ? { code: editDialog.entity.code, internalName: editDialog.entity.internalName, externalName: editDialog.entity.externalName }
      : { code: "", internalName: "", externalName: "" },
  })

  async function onSubmit(data: CreateSistemaInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateSistema(editDialog.entity.id, formData)
      : await createSistema(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Sistema atualizado" : "Sistema criado")
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

  const columns: ColumnDef<TotvsSystem>[] = useMemo(() => {
    const columns: ColumnDef<TotvsSystem>[] = [
    createSelectColumn<TotvsSystem>(),
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "internalName",
      header: "Nome Interno TOTVS",
    },
    {
      accessorKey: "externalName",
      header: "Nome Externo TOTVS",
    },
  ]

  const actionsColumn: ColumnDef<TotvsSystem> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog])

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Sistema</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Sistema" : "Novo Sistema"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input id="code" maxLength={5} {...form.register("code")} placeholder="Ex: T" aria-invalid={!!form.formState.errors.code} />
            <FieldError errors={[form.formState.errors.code]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="internalName">Nome Interno TOTVS</FieldLabel>
            <Input id="internalName" {...form.register("internalName")} placeholder="Ex: RM Nucleus" aria-invalid={!!form.formState.errors.internalName} />
            <FieldError errors={[form.formState.errors.internalName]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="externalName">Nome Externo TOTVS</FieldLabel>
            <Input id="externalName" {...form.register("externalName")} placeholder="Ex: Estoque, Compras e Faturamento" aria-invalid={!!form.formState.errors.externalName} />
            <FieldError errors={[form.formState.errors.externalName]} />
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
      <PageHeader title="Sistemas TOTVS" description="Gerenciar sistemas/módulos TOTVS RM" />

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
        toolbarActions={canCreate ? newDialog : undefined}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.code,
          action: bulkDeleteSistemas,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Sistema"
        description="Tem certeza que deseja excluir este sistema? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
