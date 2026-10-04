"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createRole, updateRole } from "@/actions/admin/roles"
import { createRoleSchema, updateRoleSchema, type CreateRoleInput } from "@/schemas/role.schema"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PermissionTree } from "@/components/shared/permission-tree"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const LIST_HREF = "/admin/roles"

type PermissionRow = { id: string; resource: string; resourceLabel: string; action: string; name: string; module: string }

interface RoleFormProps {
  role: { id: string; name: string; description: string | null; isSystem: boolean; permissionIds: string[] } | null
  permissions: PermissionRow[]
  canSave: boolean
}

export function RoleForm({ role, permissions, canSave }: RoleFormProps) {
  const router = useRouter()
  const [tab, setTab] = useState("general")
  const [loading, setLoading] = useState(false)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const form = useForm<CreateRoleInput>({
    mode: "onChange",
    resolver: zodResolver(role ? updateRoleSchema : createRoleSchema) as Resolver<CreateRoleInput>,
    defaultValues: {
      name: role?.name ?? "",
      description: role?.description ?? "",
      permissionIds: role?.permissionIds ?? [],
    },
  })

  const selectedIds: string[] = form.watch("permissionIds") || []

  function setPermissionIds(ids: string[]) {
    form.setValue("permissionIds", ids, { shouldDirty: true })
  }

  function togglePermission(id: string, checked: boolean) {
    const current: string[] = form.getValues("permissionIds") || []
    setPermissionIds(checked ? [...current, id] : current.filter((p) => p !== id))
  }

  function toggleIds(ids: string[], checked: boolean) {
    const current: string[] = form.getValues("permissionIds") || []
    setPermissionIds(checked ? Array.from(new Set([...current, ...ids])) : current.filter((p) => !ids.includes(p)))
  }

  async function onSubmit(data: CreateRoleInput) {
    setLoading(true)
    const formData = new FormData()
    formData.append("name", data.name)
    if (data.description) formData.append("description", data.description)
    for (const id of data.permissionIds || []) formData.append("permissionIds", id)

    const result = role ? await updateRole(role.id, formData) : await createRole(formData)
    setLoading(false)

    if (!result.success) {
      toast.error(result.error || "Erro ao salvar")
      return
    }

    toast.success(role ? "Papel atualizado" : "Papel criado")
    form.reset(data)
    if (role) router.refresh()
    else if (result.data) router.replace(`${LIST_HREF}/${result.data.id}`)
  }

  function handleCancel() {
    if (form.formState.isDirty) setLeaveOpen(true)
    else router.push(LIST_HREF)
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          if (errors.name) setTab("general")
        })}
        className="space-y-4"
      >
        <div className="flex flex-wrap items-center gap-2 border-b pb-4">
          <Button type="button" variant="ghost" size="icon-sm" title="Voltar" onClick={handleCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-semibold">{role ? role.name : "Novo Papel"}</h1>
          {role?.isSystem && <Badge variant="secondary">sistema</Badge>}
          <div className="ml-auto flex items-center gap-2">
            {form.formState.isDirty && <span className="text-xs text-muted-foreground">Alterações não salvas</span>}
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>
              Cancelar
            </Button>
            {canSave && (
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
            )}
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as string)}>
          <TabsList>
            <TabsTrigger value="general">Geral</TabsTrigger>
            <TabsTrigger value="permissions">
              Permissões
              <Badge variant="secondary" className="ml-1">
                {selectedIds.length}/{permissions.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="name">Nome</FieldLabel>
                <Input
                  id="name"
                  className="w-full"
                  {...form.register("name")}
                  placeholder="Ex: suporte"
                  disabled={!canSave}
                  aria-invalid={!!form.formState.errors.name}
                />
                <FieldError errors={[form.formState.errors.name]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="description">Descrição</FieldLabel>
                <Input
                  id="description"
                  className="w-full"
                  {...form.register("description")}
                  placeholder="Descrição do papel"
                  disabled={!canSave}
                />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="permissions" className="pt-2">
            <PermissionTree
              permissions={permissions}
              selectedIds={selectedIds}
              onTogglePermission={togglePermission}
              onToggleIds={toggleIds}
              onSelectAll={() => setPermissionIds(permissions.map((p) => p.id))}
              onDeselectAll={() => setPermissionIds([])}
              disabled={!canSave}
            />
          </TabsContent>
        </Tabs>
      </form>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Descartar alterações?"
        description="Existem alterações não salvas neste papel. Deseja sair mesmo assim?"
        confirmLabel="Descartar e sair"
        variant="destructive"
        onConfirm={() => router.push(LIST_HREF)}
      />
    </div>
  )
}
