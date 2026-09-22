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
import { TruncatedText } from "@/components/shared/truncated-text"
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
import { deleteDemandType, createDemandType, updateDemandType, bulkDeleteDemandTypes } from "@/actions/demand-types"
import { createDemandTypeSchema, updateDemandTypeSchema, type CreateDemandTypeInput } from "@/schemas/demand-type.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { DemandType } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface DemandTypeTableProps {
  data: DemandType[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["name", "description"]

function randomColor() {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0")}`
}

export function DemandTypeTable({ data, meta }: DemandTypeTableProps) {
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
  } = useCrudTable<DemandType>({
    deleteAction: deleteDemandType,
    deleteSuccessMessage: "Tipo excluído com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const canCreate = useHasPermission("demand_types", "create")
  const canUpdate = useHasPermission("demand_types", "update")
  const canDelete = useHasPermission("demand_types", "delete")
  const [loading, setLoading] = useState(false)
  const [newColor, setNewColor] = useState(randomColor)

  const form = useForm<CreateDemandTypeInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDemandTypeSchema : createDemandTypeSchema) as Resolver<CreateDemandTypeInput>,
    values: editDialog.entity
      ? { name: editDialog.entity.name, description: editDialog.entity.description || "", color: editDialog.entity.color }
      : { name: "", description: "", color: newColor },
  })

  async function onSubmit(data: CreateDemandTypeInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateDemandType(editDialog.entity.id, formData)
      : await createDemandType(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Tipo atualizado" : "Tipo criado")
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

  const columns: ColumnDef<DemandType>[] = useMemo(() => {
    const columns: ColumnDef<DemandType>[] = [
    createSelectColumn<DemandType>(),
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.original.color }} />
          <TruncatedText text={row.original.name} />
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => <TruncatedText text={(row.getValue("description") as string) || "-"} />,
    },
  ]

  const actionsColumn: ColumnDef<DemandType> = {
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
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (open && !editDialog.entity) setNewColor(randomColor())
        if (!open) form.reset()
      }}
    >
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Tipo</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Tipo de Demanda" : "Novo Tipo de Demanda"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do tipo" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Textarea id="description" {...form.register("description")} placeholder="Descrição (opcional)" />
          </Field>
          <Field>
            <FieldLabel htmlFor="color">Cor</FieldLabel>
            <Input id="color" type="color" className="h-10 p-1" style={{ width: "30%" }} {...form.register("color")} />
            <FieldError errors={[form.formState.errors.color]} />
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
      <PageHeader title="Tipos de Demanda" description="Gerenciar tipos de demanda" />

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
        toolbarActions={canCreate ? newDialog : undefined}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteDemandTypes,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Tipo de Demanda"
        description="Tem certeza que deseja excluir este tipo? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
