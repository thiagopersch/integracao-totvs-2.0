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
import { Checkbox } from "@/components/ui/checkbox"
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
import { createRole, updateRole, deleteRole } from "@/actions/admin/roles"
import { createRoleSchema, updateRoleSchema, type CreateRoleInput } from "@/schemas/role.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"

type PermissionRow = { id: string; resource: string; action: string; name: string; module: string }
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
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")

  const filteredData = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data
    return data.filter(
      (role) => role.name.toLowerCase().includes(term) || (role.description || "").toLowerCase().includes(term)
    )
  }, [data, search])

  const permissionsByModule = permissions.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    acc[p.module] = acc[p.module] || []
    acc[p.module].push(p)
    return acc
  }, {})

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

  function toggleModule(module: string, checked: boolean) {
    const moduleIds = permissionsByModule[module].map((p) => p.id)
    const current: string[] = form.getValues("permissionIds") || []
    form.setValue(
      "permissionIds",
      checked ? Array.from(new Set([...current, ...moduleIds])) : current.filter((p) => !moduleIds.includes(p))
    )
  }

  const columns: ColumnDef<RoleRow>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          {row.original.name}
          {row.original.isSystem && <Badge variant="secondary">sistema</Badge>}
        </div>
      ),
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.description || "-"}</span>,
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
    {
      id: "actions",
      cell: ({ row }) => (
        <EntityActionsCell
          onEdit={() => setEditDialog({ open: true, entity: row.original })}
          onDelete={row.original.isSystem ? undefined : () => setDeleteDialog({ open: true, id: row.original.id })}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) form.reset()
      }}
    >
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Papel</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Papel" : "Novo Papel"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input id="name" className="w-full" {...form.register("name")} placeholder="Ex: suporte" aria-invalid={!!form.formState.errors.name} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea id="description" className="w-full" {...form.register("description")} placeholder="Descrição do papel" />
            </div>
          </div>

          <div className="border rounded-lg p-3 space-y-4">
            {Object.entries(permissionsByModule).map(([module, items]) => {
              const moduleIds = items.map((p) => p.id)
              const allChecked = moduleIds.every((id) => selectedIds.includes(id))
              return (
                <div key={module} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`module-${module}`}
                      checked={allChecked}
                      onCheckedChange={(v) => toggleModule(module, !!v)}
                    />
                    <Label htmlFor={`module-${module}`} className="font-semibold uppercase text-xs text-muted-foreground">
                      {module}
                    </Label>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pl-6">
                    {items.map((p) => (
                      <div key={p.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`perm-${p.id}`}
                          checked={selectedIds.includes(p.id)}
                          onCheckedChange={(v) => togglePermission(p.id, !!v)}
                        />
                        <Label htmlFor={`perm-${p.id}`} className="text-sm font-normal">
                          {p.name}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
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
          toolbarActions={newDialog}
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
