"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Badge } from "@/components/ui/badge"
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
import { deleteTag, createTag, updateTag } from "@/actions/tags"
import { createTagSchema, updateTagSchema, type CreateTagInput } from "@/schemas/tag.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { Tag } from "@prisma/client"

interface TagTableProps {
  data: Tag[]
}

export function TagTable({ data }: TagTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    handleDelete,
  } = useCrudTable<Tag>({
    deleteAction: deleteTag,
    deleteSuccessMessage: "Tag excluída com sucesso",
  })
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data
    return data.filter((tag) => tag.name.toLowerCase().includes(term))
  }, [data, search])

  const form = useForm<CreateTagInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateTagSchema : createTagSchema) as Resolver<CreateTagInput>,
    values: editDialog.entity ? { name: editDialog.entity.name, color: editDialog.entity.color } : { name: "", color: "#8b5cf6" },
  })

  async function onSubmit(data: CreateTagInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity ? await updateTag(editDialog.entity.id, formData) : await createTag(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Tag atualizada" : "Tag criada")
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

  const columns: ColumnDef<Tag>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <Badge style={{ backgroundColor: `${row.original.color}22`, borderColor: row.original.color, color: row.original.color }} variant="outline">
          {row.original.name}
        </Badge>
      ),
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
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) form.reset() }}
    >
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Nova Tag</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Tag" : "Nova Tag"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome da tag" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="color">Cor</FieldLabel>
            <Input id="color" type="color" className="h-10 w-20 p-1" {...form.register("color")} />
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
      <PageHeader title="Tags" description="Gerenciar tags de demandas" />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={filteredData}
          searchPlaceholder="Buscar por nome..."
          searchDefaultValue={search}
          onSearch={setSearch}
          toolbarActions={newDialog}
        />
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Tag"
        description="Tem certeza que deseja excluir esta tag?"
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
