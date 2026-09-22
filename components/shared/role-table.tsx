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
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { PermissionTree } from "@/components/shared/permission-tree"
import { TruncatedText } from "@/components/shared/truncated-text"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2, Maximize2, Minimize2 } from "lucide-react"
import { createRole, updateRole, deleteRole } from "@/actions/admin/roles"
import { createRoleSchema, updateRoleSchema, type CreateRoleInput } from "@/schemas/role.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"

type PermissionRow = { id: string; resource: string; resourceLabel: string; action: string; name: string; module: string }
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
  permissions: PermissionRow[]
}

const SORTABLE_COLUMNS = ["name", "description", "permissionsCount", "usersCount"]

export function RoleTable({ data, permissions }: RoleTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    handleDelete,
  } = useCrudTable<RoleRow>({
    deleteAction: deleteRole,
    deleteSuccessMessage: "Papel excluído com sucesso",
  })
  const canCreate = useHasPermission("roles", "create")
  const canUpdate = useHasPermission("roles", "update")
  const canDelete = useHasPermission("roles", "delete")
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [expanded, setExpanded] = useState(false)

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data
    return data.filter(
      (role) => role.name.toLowerCase().includes(term) || (role.description || "").toLowerCase().includes(term)
    )
  }, [data, search])

  const form = useForm<CreateRoleInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateRoleSchema : createRoleSchema) as Resolver<CreateRoleInput>,
    values: editDialog.entity
      ? {
          name: editDialog.entity.name,
          description: editDialog.entity.description || "",
          permissionIds: editDialog.entity.rolePermissions.map((rp) => rp.permissionId),
        }
      : { name: "", description: "", permissionIds: [] },
  })

  async function onSubmit(data: CreateRoleInput) {
    setLoading(true)
    const formData = new FormData()
    formData.append("name", data.name)
    if (data.description) formData.append("description", data.description)
    for (const id of data.permissionIds || []) formData.append("permissionIds", id)

    const result = editDialog.entity ? await updateRole(editDialog.entity.id, formData) : await createRole(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Papel atualizado" : "Papel criado")
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

  const selectedIds: string[] = form.watch("permissionIds") || []

  function togglePermission(id: string, checked: boolean) {
    const current: string[] = form.getValues("permissionIds") || []
    form.setValue("permissionIds", checked ? [...current, id] : current.filter((p) => p !== id))
  }

  function toggleIds(ids: string[], checked: boolean) {
    const current: string[] = form.getValues("permissionIds") || []
    form.setValue(
      "permissionIds",
      checked ? Array.from(new Set([...current, ...ids])) : current.filter((p) => !ids.includes(p))
    )
  }

  function selectAllPermissions() {
    form.setValue("permissionIds", permissions.map((p) => p.id))
  }

  function deselectAllPermissions() {
    form.setValue("permissionIds", [])
  }

  const columns: ColumnDef<RoleRow>[] = useMemo(() => {
    const columns: ColumnDef<RoleRow>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <TruncatedText text={row.original.name} />
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
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete && !row.original.isSystem ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog])

  const newDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) {
          form.reset()
          setExpanded(false)
        }
      }}
    >
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Papel</Button>} />
      <DialogContent
        className={expanded ? "w-[90vw] max-w-[90vw] h-[90vh] max-h-[90vh]" : undefined}
        headerActions={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            aria-label={expanded ? "Restaurar tamanho" : "Expandir"}
          >
            {expanded ? <Minimize2 /> : <Maximize2 />}
          </Button>
        }
      >
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Papel" : "Novo Papel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" className="w-full" {...form.register("name")} placeholder="Ex: suporte" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" className="w-full" rows={3} {...form.register("description")} placeholder="Descrição do papel" />
          </div>

          <div className="space-y-2">
            <Label>Permissões</Label>
            <PermissionTree
              permissions={permissions}
              selectedIds={selectedIds}
              onTogglePermission={togglePermission}
              onToggleIds={toggleIds}
              onSelectAll={selectAllPermissions}
              onDeselectAll={deselectAllPermissions}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
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
      <PageHeader title="Papéis e Permissões" description="Gerenciar papéis (roles) e as permissões concedidas a cada um" />

      <div className="px-6 pb-6">
        <DataTable
          columns={columns}
          data={filteredData}
          searchPlaceholder="Buscar por nome ou descrição..."
          searchDefaultValue={search}
          onSearch={setSearch}
          toolbarActions={canCreate ? newDialog : undefined}
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
