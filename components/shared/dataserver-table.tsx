"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
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
import { deleteDataserver, restoreDataserver, bulkDeleteDataservers, bulkRestoreDataservers, createDataserver, updateDataserver } from "@/actions/admin/dataservers"
import { createDataserverSchema, updateDataserverSchema } from "@/schemas/dataserver.schema"
import { toast } from "sonner"
import type { Dataserver } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface DataserverTableProps {
  data: Dataserver[]
  meta: PaginationMeta
}

export function DataserverTable({ data, meta }: DataserverTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; dataserver?: Dataserver }>({ open: false })
  const [loading, setLoading] = useState(false)

  const form = useForm<any>({
    resolver: zodResolver(editDialog.dataserver ? updateDataserverSchema : createDataserverSchema),
    values: editDialog.dataserver
      ? { code: editDialog.dataserver.code, nameAlternative: editDialog.dataserver.nameAlternative || "", name: editDialog.dataserver.name }
      : { code: "", nameAlternative: "", name: "" },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.dataserver
      ? await updateDataserver(editDialog.dataserver.id, formData)
      : await createDataserver(formData)

    if (result.success) {
      toast.success(editDialog.dataserver ? "Dataserver atualizado" : "Dataserver criado")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteDataserver(id)
    if (result.success) {
      toast.success("Dataserver excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreDataserver(id)
    if (result.success) {
      toast.success("Dataserver restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<Dataserver>[] = [
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
      accessorKey: "nameAlternative",
      header: "Nome Alternativo",
      cell: ({ row }) => row.getValue("nameAlternative") || "-",
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, dataserver: row.original })}>
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
      <PageHeader title="Dataservers" description="Gerenciar dataservers">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, dataserver: open ? editDialog.dataserver : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Dataserver
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.dataserver ? "Editar Dataserver" : "Novo Dataserver"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" {...form.register("code")} placeholder="Código único" />
                {form.formState.errors.code && <p className="text-sm text-destructive">{form.formState.errors.code.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} placeholder="Nome do dataserver" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="nameAlternative">Nome Alternativo</Label>
                <Input id="nameAlternative" {...form.register("nameAlternative")} placeholder="Nome alternativo (opcional)" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.dataserver ? "Atualizar" : "Criar"} Dataserver
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
        title="Excluir Dataserver"
        description="Tem certeza que deseja excluir este dataserver? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
