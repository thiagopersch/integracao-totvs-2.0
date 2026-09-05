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
import { TruncatedText } from "@/components/shared/truncated-text"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { deleteSentenceCategory, restoreSentenceCategory, createSentenceCategory, updateSentenceCategory, bulkDeleteSentenceCategories, setSentenceCategoryStatus } from "@/actions/admin/sentence-categories"
import { createSentenceCategorySchema, updateSentenceCategorySchema, type CreateSentenceCategoryInput } from "@/schemas/sentence-category.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { SentenceCategory } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SentenceCategoryTableProps {
  data: SentenceCategory[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["code", "name", "status"]

export function SentenceCategoryTable({ data, meta }: SentenceCategoryTableProps) {
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
  } = useCrudTable<SentenceCategory>({
    deleteAction: deleteSentenceCategory,
    restoreAction: restoreSentenceCategory,
    setStatusAction: setSentenceCategoryStatus,
    deleteSuccessMessage: "Categoria excluída com sucesso",
    restoreSuccessMessage: "Categoria restaurada com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const canCreate = useHasPermission("sentence_categories", "create")
  const canUpdate = useHasPermission("sentence_categories", "update")
  const canDelete = useHasPermission("sentence_categories", "delete")
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  const form = useForm<CreateSentenceCategoryInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateSentenceCategorySchema : createSentenceCategorySchema) as Resolver<CreateSentenceCategoryInput>,
    values: editDialog.entity
      ? { code: editDialog.entity.code, name: editDialog.entity.name, status: editDialog.entity.status }
      : { code: "", name: "", status: true },
  })

  async function onSubmit(data: CreateSentenceCategoryInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateSentenceCategory(editDialog.entity.id, formData)
      : await createSentenceCategory(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Categoria atualizada" : "Categoria criada")
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

  const columns: ColumnDef<SentenceCategory>[] = [
    createSelectColumn<SentenceCategory>(),
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => <TruncatedText text={row.original.name} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as boolean
        return <Badge variant={status ? "default" : "secondary"}>{status ? "Ativo" : "Inativo"}</Badge>
      },
    },
  ]

  const actionsColumn: ColumnDef<SentenceCategory> = {
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

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Nova Categoria</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox
                  id="status"
                  checked={field.value ?? true}
                  onCheckedChange={(value) => field.onChange(!!value)}
                />
              )}
            />
            <Label htmlFor="status">Categoria ativa</Label>
          </div>
          <Field className="w-[30%]">
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input id="code" {...form.register("code")} placeholder="Código único" aria-invalid={!!form.formState.errors.code} />
            <FieldError errors={[form.formState.errors.code]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome da categoria" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
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
      <PageHeader title="Categorias de Sentenças" description="Gerenciar categorias de sentenças" />

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
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.code,
          action: bulkDeleteSentenceCategories,
          onSuccess: () => router.refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Categoria"
        description="Tem certeza que deseja excluir esta categoria? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
