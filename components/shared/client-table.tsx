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
import { deleteClient, restoreClient, bulkDeleteClients, bulkRestoreClients, createClient, updateClient } from "@/actions/admin/clients"
import { createClientSchema, updateClientSchema } from "@/schemas/client.schema"
import { toast } from "sonner"
import type { Client } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface ClientTableProps {
  data: Client[]
  meta: PaginationMeta
}

export function ClientTable({ data, meta }: ClientTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; client?: Client }>({ open: false })
  const [loading, setLoading] = useState(false)

  const form = useForm<any>({
    resolver: zodResolver(editDialog.client ? updateClientSchema : createClientSchema),
    values: editDialog.client
      ? { image: editDialog.client.image || "", name: editDialog.client.name, linkCrm: editDialog.client.linkCrm, site: editDialog.client.site || "", status: editDialog.client.status }
      : { image: "", name: "", linkCrm: "", site: "", status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.client
      ? await updateClient(editDialog.client.id, formData)
      : await createClient(formData)

    if (result.success) {
      toast.success(editDialog.client ? "Cliente atualizado" : "Cliente criado")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteClient(id)
    if (result.success) {
      toast.success("Cliente excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreClient(id)
    if (result.success) {
      toast.success("Cliente restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<Client>[] = [
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
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "linkCrm",
      header: "Link CRM",
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, client: row.original })}>
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
      <PageHeader title="Clientes" description="Gerenciar clientes">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, client: open ? editDialog.client : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Cliente
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" {...form.register("name")} placeholder="Nome do cliente" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkCrm">Link CRM</Label>
                <Input id="linkCrm" {...form.register("linkCrm")} placeholder="https://crm.exemplo.com" />
                {form.formState.errors.linkCrm && <p className="text-sm text-destructive">{form.formState.errors.linkCrm.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="image">URL da Imagem</Label>
                <Input id="image" {...form.register("image")} placeholder="https://exemplo.com/imagem.jpg (opcional)" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="site">Site</Label>
                <Input id="site" {...form.register("site")} placeholder="https://site.com.br (opcional)" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" defaultChecked={editDialog.client?.status ?? true} {...form.register("status")} className="rounded border-gray-300" />
                <Label htmlFor="status">Cliente ativo</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.client ? "Atualizar" : "Criar"} Cliente
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por nome ou link CRM..."
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
