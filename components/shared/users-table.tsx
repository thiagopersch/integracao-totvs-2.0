"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import type { ColumnDef, Row } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
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
import { MoreHorizontal, Plus, Trash2, RotateCcw, Pencil } from "lucide-react"
import { deleteUser, restoreUser, bulkDeleteUsers, bulkRestoreUsers } from "@/actions/admin/users"
import { toast } from "sonner"
import { UserForm } from "./user-form"
import type { User } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface UsersTableProps {
  data: User[]
  meta: PaginationMeta
}

export function UsersTable({ data, meta }: UsersTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; user?: User }>({ open: false })

  async function handleDelete(id: string) {
    const result = await deleteUser(id)
    if (result.success) {
      toast.success("Usuário excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreUser(id)
    if (result.success) {
      toast.success("Usuário restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<User>[] = [
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
      accessorKey: "email",
      header: "E-mail",
    },
    {
      accessorKey: "role",
      header: "Perfil",
      cell: ({ row }) => {
        const role = row.getValue("role") as string
        const variants: Record<string, string> = {
          ADMIN: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
          MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
          USER: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
        }
        return <Badge className={variants[role] || ""}>{role}</Badge>
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, user: row.original })}>
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
      <PageHeader title="Usuários" description="Gerenciar usuários do sistema">
        <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, user: open ? editDialog.user : undefined })}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Usuário
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.user ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
            </DialogHeader>
            <UserForm user={editDialog.user} onSuccess={() => { setEditDialog({ open: false }); router.refresh() }} />
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por nome ou e-mail..."
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Usuário"
        description="Tem certeza que deseja excluir este usuário? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
