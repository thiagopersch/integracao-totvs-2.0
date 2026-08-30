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
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import { Plus, Building2, Loader2 } from "lucide-react"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { deleteUser, restoreUser, bulkDeleteUsers, setUserStatus, setUserClients } from "@/actions/admin/users"
import { UserForm } from "./user-form"
import { useCrudTable } from "@/hooks/use-crud-table"
import { toast } from "sonner"
import type { User, Client } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface UserRow extends User {
  allowedClients: { id: string; name: string }[]
}

interface UsersTableProps {
  data: UserRow[]
  meta: PaginationMeta
  clients: Client[]
}

const SORTABLE_COLUMNS = ["name", "email", "role", "status"]

export function UsersTable({ data, meta, clients }: UsersTableProps) {
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
  } = useCrudTable<UserRow>({
    deleteAction: deleteUser,
    restoreAction: restoreUser,
    setStatusAction: setUserStatus,
    deleteSuccessMessage: "Usuário excluído com sucesso",
    restoreSuccessMessage: "Usuário restaurado com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const [roleFilter, setRoleFilter] = useState(searchParams.get("role") || "")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [clientsDialog, setClientsDialog] = useState<{ open: boolean; userId?: string; userName?: string; selected: Set<string> }>({
    open: false,
    selected: new Set(),
  })
  const [savingClients, setSavingClients] = useState(false)

  function openClientsDialog(user: UserRow) {
    setClientsDialog({ open: true, userId: user.id, userName: user.name, selected: new Set(user.allowedClients.map((c) => c.id)) })
  }

  function toggleClient(clientId: string) {
    setClientsDialog((prev) => {
      const next = new Set(prev.selected)
      if (next.has(clientId)) next.delete(clientId)
      else next.add(clientId)
      return { ...prev, selected: next }
    })
  }

  async function handleSaveClients() {
    if (!clientsDialog.userId) return
    setSavingClients(true)
    const result = await setUserClients(clientsDialog.userId, Array.from(clientsDialog.selected))
    if (result.success) {
      toast.success("Clientes atualizados")
      setClientsDialog({ open: false, selected: new Set() })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setSavingClients(false)
  }

  const columns: ColumnDef<UserRow>[] = [
    createSelectColumn<UserRow>(),
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
      id: "allowedClients",
      header: "Clientes",
      cell: ({ row }) => {
        const allowed = row.original.allowedClients
        if (allowed.length === 0) return <span className="text-muted-foreground text-sm">Nenhum</span>
        const shown = allowed.slice(0, 2)
        const rest = allowed.length - shown.length
        return (
          <div className="flex flex-wrap items-center gap-1">
            {shown.map((c) => (
              <Badge key={c.id} variant="outline">{c.name}</Badge>
            ))}
            {rest > 0 && <Badge variant="outline">+{rest}</Badge>}
          </div>
        )
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={() => setDeleteDialog({ open: true, id: row.original.id })}
          onToggleStatus={() => handleToggleStatus(row.original.id, row.original.status)}
          isActive={row.original.status}
          extraItems={
            <DropdownMenuItem onClick={() => openClientsDialog(row.original)}>
              <Building2 className="h-4 w-4 mr-2" /> Clientes
            </DropdownMenuItem>
          }
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
          key={editDialog.entity?.id ?? "new"}
          user={editDialog.entity}
          onSuccess={() => { setEditDialog({ open: false }); router.refresh() }}
          onCancel={() => setEditDialog({ open: false })}
        />
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ role: roleFilter || undefined, status: statusFilter || undefined, page: 1 })}
      onClear={() => {
        setRoleFilter("")
        setStatusFilter("")
        pushParams({ role: undefined, status: undefined, page: 1 })
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
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
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

      <Dialog
        open={clientsDialog.open}
        onOpenChange={(open) => setClientsDialog({ open, selected: open ? clientsDialog.selected : new Set() })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Clientes de {clientsDialog.userName}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Selecione os clientes que este usuário pode acessar. Sem clientes selecionados, o usuário não visualiza filtros, contratos, TBCs ou backups de nenhum cliente.
            </p>
            <Command className="rounded-lg border border-input">
              <CommandInput placeholder="Buscar cliente..." />
              <CommandList>
                <CommandEmpty>Nenhum cliente encontrado.</CommandEmpty>
                <CommandGroup>
                  {clients.map((client) => (
                    <CommandItem
                      key={client.id}
                      value={client.name}
                      data-checked={clientsDialog.selected.has(client.id)}
                      onSelect={() => toggleClient(client.id)}
                    >
                      {client.name}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setClientsDialog({ open: false, selected: new Set() })} disabled={savingClients}>
              Cancelar
            </Button>
            <Button type="button" onClick={handleSaveClients} disabled={savingClients}>
              {savingClients && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
