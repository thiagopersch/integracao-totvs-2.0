"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
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
import { MoreHorizontal, Plus, Trash2, RotateCcw, Pencil, Loader2 } from "lucide-react"
import { deleteSentenceCategory, restoreSentenceCategory, bulkDeleteSentenceCategories, bulkRestoreSentenceCategories, createSentenceCategory, updateSentenceCategory } from "@/actions/admin/sentence-categories"
import { createSentenceCategorySchema, updateSentenceCategorySchema } from "@/schemas/sentence-category.schema"
import { toast } from "sonner"
import type { SentenceCategory } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SentenceCategoryTableProps {
  data: SentenceCategory[]
  meta: PaginationMeta
}

export function SentenceCategoryTable({ data, meta }: SentenceCategoryTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; category?: SentenceCategory }>({ open: false })
  const [loading, setLoading] = useState(false)

  const form = useForm<any>({
    resolver: zodResolver(editDialog.category ? updateSentenceCategorySchema : createSentenceCategorySchema),
    values: editDialog.category
      ? { code: editDialog.category.code, name: editDialog.category.name, status: editDialog.category.status }
      : { code: "", name: "", status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.category
      ? await updateSentenceCategory(editDialog.category.id, formData)
      : await createSentenceCategory(formData)

    if (result.success) {
      toast.success(editDialog.category ? "Categoria atualizada" : "Categoria criada")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteSentenceCategory(id)
    if (result.success) {
      toast.success("Categoria excluída com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreSentenceCategory(id)
    if (result.success) {
      toast.success("Categoria restaurada com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<SentenceCategory>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nome",
    },
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, category: row.original })}>
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

  return (
    <>
      <PageHeader title="Categorias de Sentenças" description="Gerenciar categorias de sentenças">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, category: open ? editDialog.category : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Categoria
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.category ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" {...form.register("code")} placeholder="Código único" />
                {form.formState.errors.code && <p className="text-sm text-destructive">{form.formState.errors.code.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} placeholder="Nome da categoria" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" defaultChecked={editDialog.category?.status ?? true} {...form.register("status")} className="rounded border-gray-300" />
                <Label htmlFor="status">Categoria ativa</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.category ? "Atualizar" : "Criar"} Categoria
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por código ou nome..."
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
