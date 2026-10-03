"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TruncatedText } from "@/components/shared/truncated-text"
import { Plus } from "lucide-react"
import { deleteRole } from "@/actions/admin/roles"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"

const BASE_HREF = "/admin/roles"

type RoleRow = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  rolePermissions: { permissionId: string }[]
  userRoles: { userId: string }[]
}

interface RoleTableProps {
  data: RoleRow[]
}

const SORTABLE_COLUMNS = ["name", "description", "permissionsCount", "usersCount"]

export function RoleTable({ data }: RoleTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    handleDelete,
  } = useCrudTable<RoleRow>({
    deleteAction: deleteRole,
    deleteSuccessMessage: "Papel excluído com sucesso",
  })
  const canCreate = useHasPermission("roles", "create")
  const canUpdate = useHasPermission("roles", "update")
  const canDelete = useHasPermission("roles", "delete")
  const [search, setSearch] = useState("")

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data
    return data.filter(
      (role) => role.name.toLowerCase().includes(term) || (role.description || "").toLowerCase().includes(term)
    )
  }, [data, search])

  const columns: ColumnDef<RoleRow>[] = useMemo(() => {
    const columns: ColumnDef<RoleRow>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <Link href={`${BASE_HREF}/${row.original.id}`} className="min-w-0 hover:underline">
            <TruncatedText text={row.original.name} />
          </Link>
          {row.original.isSystem && <Badge variant="secondary" className="shrink-0">sistema</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => <TruncatedText text={row.original.description || "-"} className="text-muted-foreground" />,
    },
    {
      id: "permissionsCount",
      accessorFn: (row) => row.rolePermissions.length,
      header: "Permissões",
    },
    {
      id: "usersCount",
      accessorFn: (row) => row.userRoles.length,
      header: "Usuários",
    },
  ]

  const actionsColumn: ColumnDef<RoleRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => router.push(`${BASE_HREF}/${row.original.id}`) : undefined}
        onDelete={canDelete && !row.original.isSystem ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, router, setDeleteDialog])

  const newButton = (
    <Link href={`${BASE_HREF}/new`} className={buttonVariants()}>
      <Plus className="h-4 w-4 mr-2" /> Novo Papel
    </Link>
  )

  return (
    <>
      <PageHeader title="Papéis e Permissões" description="Gerenciar papéis (roles) e as permissões concedidas a cada um" />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={filteredData}
          searchPlaceholder="Buscar por nome ou descrição..."
          searchDefaultValue={search}
          onSearch={setSearch}
          toolbarActions={canCreate ? newButton : undefined}
          sortableColumns={SORTABLE_COLUMNS}
        />
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Papel"
        description="Tem certeza que deseja excluir este papel? Esta ação não pode ser revertida."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
