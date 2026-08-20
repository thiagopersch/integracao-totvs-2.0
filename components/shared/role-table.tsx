"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { MoreHorizontal, Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import { createRole, updateRole, deleteRole } from "@/actions/admin/roles"
import { createRoleSchema, updateRoleSchema } from "@/schemas/role.schema"
import { toast } from "sonner"

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

export function RoleTable({ data, permissions }: RoleTableProps) {
  const router = useRouter()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; role?: RoleRow }>({ open: false })
  const [loading, setLoading] = useState(false)

  const permissionsByModule = permissions.reduce<Record<string, PermissionRow[]>>((acc, p) => {
    acc[p.module] = acc[p.module] || []
    acc[p.module].push(p)
    return acc
  }, {})

  const form = useForm<any>({
    resolver: zodResolver(editDialog.role ? updateRoleSchema : createRoleSchema),
    values: editDialog.role
      ? {
          name: editDialog.role.name,
          description: editDialog.role.description || "",
          permissionIds: editDialog.role.rolePermissions.map((rp) => rp.permissionId),
        }
      : { name: "", description: "", permissionIds: [] },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    formData.append("name", data.name)
    if (data.description) formData.append("description", data.description)
    for (const id of data.permissionIds || []) formData.append("permissionIds", id)

    const result = editDialog.role ? await updateRole(editDialog.role.id, formData) : await createRole(formData)

    if (result.success) {
      toast.success(editDialog.role ? "Papel atualizado" : "Papel criado")
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

  async function handleDelete(id: string) {
    const result = await deleteRole(id)
    if (result.success) {
      toast.success("Papel excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
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

  return (
    <>
      <PageHeader title="Papéis e Permissões" description="Gerenciar papéis (roles) e as permissões concedidas a cada um">
        <Dialog
          open={editDialog.open}
          onOpenChange={(open) => {
            setEditDialog({ open, role: open ? editDialog.role : undefined })
            if (!open) form.reset()
          }}
        >
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Papel
          </DialogTrigger>
          <DialogContent className="flex w-[70vw] min-w-[70vw] max-w-[70vw] h-[80vh] min-h-[80vh] max-h-[80vh] flex-col sm:max-w-none">
            <DialogHeader>
              <DialogTitle>{editDialog.role ? "Editar Papel" : "Novo Papel"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col gap-4 overflow-hidden">
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

              <div className="flex-1 overflow-y-auto border rounded-lg p-3 space-y-4">
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

              <div className="flex items-center justify-end gap-2 pt-2 border-t">
                <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Salvar
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="px-6 pb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Permissões</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((role) => (
              <TableRow key={role.id}>
                <TableCell className="font-medium flex items-center gap-2">
                  {role.name}
                  {role.isSystem && <Badge variant="secondary">sistema</Badge>}
                </TableCell>
                <TableCell className="text-muted-foreground">{role.description || "-"}</TableCell>
                <TableCell>{role.rolePermissions.length}</TableCell>
                <TableCell>{role.userRoles.length}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
                      <MoreHorizontal className="h-4 w-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setEditDialog({ open: true, role })}>
                        <Pencil className="h-4 w-4 mr-2" /> Editar
                      </DropdownMenuItem>
                      {!role.isSystem && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteDialog({ open: true, id: role.id })}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
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
