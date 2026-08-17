"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { deleteTbc, restoreTbc, bulkDeleteTbcs, bulkRestoreTbcs, createTbc, updateTbc } from "@/actions/admin/tbcs"
import { listAllClients } from "@/actions/admin/clients"
import { createTbcSchema, updateTbcSchema } from "@/schemas/tbc.schema"
import { toast } from "sonner"
import type { PaginationMeta } from "@/types/common"
import type { TbcRow } from "@/services/tbc.service"
import type { Client } from "@prisma/client"

interface TbcTableProps {
  data: TbcRow[]
  meta: PaginationMeta
}

export function TbcTable({ data, meta }: TbcTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; tbc?: TbcRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    listAllClients().then(setClients)
  }, [])

  const form = useForm<any>({
    resolver: zodResolver(editDialog.tbc ? updateTbcSchema : createTbcSchema),
    values: editDialog.tbc
      ? { clientId: editDialog.tbc.clientId, name: editDialog.tbc.name, link: editDialog.tbc.link, user: editDialog.tbc.user, password: "", notRequiredLicense: editDialog.tbc.notRequiredLicense, status: editDialog.tbc.status }
      : { clientId: "", name: "", link: "", user: "", password: "", notRequiredLicense: false, status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.tbc
      ? await updateTbc(editDialog.tbc.id, formData)
      : await createTbc(formData)

    if (result.success) {
      toast.success(editDialog.tbc ? "TBC atualizado" : "TBC criado")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteTbc(id)
    if (result.success) {
      toast.success("TBC excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreTbc(id)
    if (result.success) {
      toast.success("TBC restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<TbcRow>[] = [
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
      id: "clientName",
      header: "Cliente",
      cell: ({ row }) => row.original.client?.name || "-",
    },
    {
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "link",
      header: "Link",
    },
    {
      accessorKey: "hasPassword",
      header: "Senha",
      cell: ({ row }) => {
        const has = row.getValue("hasPassword") as boolean
        return <Badge variant={has ? "default" : "secondary"}>{has ? "Configurada" : "Não configurada"}</Badge>
      },
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, tbc: row.original })}>
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
      <PageHeader title="TBCs" description="Gerenciar TBCs">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, tbc: open ? editDialog.tbc : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo TBC
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.tbc ? "Editar TBC" : "Novo TBC"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clientId">Cliente</Label>
                <Select
                  value={form.watch("clientId") || undefined}
                  onValueChange={(v) => form.setValue("clientId", v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" className="w-full" {...form.register("name")} placeholder="Nome do TBC" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="link">Link</Label>
                <Input id="link" className="w-full" {...form.register("link")} placeholder="https://tbc.exemplo.com" />
                {form.formState.errors.link && <p className="text-sm text-destructive">{form.formState.errors.link.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="user">Usuário</Label>
                <Input id="user" className="w-full" {...form.register("user")} placeholder="Usuário de acesso" />
                {form.formState.errors.user && <p className="text-sm text-destructive">{form.formState.errors.user.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{editDialog.tbc ? "Nova Senha (deixe vazio para manter)" : "Senha"}</Label>
                <Input id="password" className="w-full" type="password" {...form.register("password")} placeholder={editDialog.tbc ? "Deixe vazio para manter a atual" : "Senha de acesso"} />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="notRequiredLicense" defaultChecked={editDialog.tbc?.notRequiredLicense ?? false} {...form.register("notRequiredLicense")} className="rounded border-gray-300" />
                <Label htmlFor="notRequiredLicense">Licença não obrigatória</Label>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" defaultChecked={editDialog.tbc?.status ?? true} {...form.register("status")} className="rounded border-gray-300" />
                <Label htmlFor="status">TBC ativo</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.tbc ? "Atualizar" : "Criar"} TBC
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por nome ou link..."
        onSearch={(v) => router.push(`?search=${encodeURIComponent(v)}`)}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir TBC"
        description="Tem certeza que deseja excluir este TBC? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
