"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus } from "lucide-react"
import { deleteUser, restoreUser, bulkDeleteUsers } from "@/actions/admin/users"
import { UserForm } from "./user-form"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { User } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface UsersTableProps {
  data: User[]
  meta: PaginationMeta
}

export function UsersTable({ data, meta }: UsersTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
  } = useCrudTable<User>({
    deleteAction: deleteUser,
    restoreAction: restoreUser,
    deleteSuccessMessage: "Usuário excluído com sucesso",
    restoreSuccessMessage: "Usuário restaurado com sucesso",
  })
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "")

  const columns: ColumnDef<User>[] = [
    createSelectColumn<User>(),
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
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={() => setDeleteDialog({ open: true, id: row.original.id })}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, entity: open ? editDialog.entity : undefined })}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Usuário</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Usuário" : "Novo Usuário"}</DialogTitle>
        </DialogHeader>
        <UserForm
          user={editDialog.entity}
          onSuccess={() => { setEditDialog({ open: false }); router.refresh() }}
          onCancel={() => setEditDialog({ open: false })}
        />
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ role: roleFilter || undefined, page: 1 })}
      onClear={() => {
        setRoleFilter("")
        pushParams({ role: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Perfil</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "ADMIN", label: "Administrador" },
            { value: "MANAGER", label: "Gerente" },
            { value: "USER", label: "Usuário" },
          ]}
          value={roleFilter || "all"}
          onValueChange={(v) => setRoleFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="ADMIN">Administrador</SelectItem>
            <SelectItem value="MANAGER">Gerente</SelectItem>
            <SelectItem value="USER">Usuário</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Usuários" description="Gerenciar usuários do sistema" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome ou e-mail..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteUsers,
          onSuccess: () => router.refresh(),
        }}
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
