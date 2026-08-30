"use client"

import { createTbc, deleteTbc, restoreTbc, updateTbc, bulkDeleteTbcs, setTbcStatus } from "@/actions/admin/tbcs"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { PageHeader } from "@/components/shared/page-header"
import { createSelectColumn } from "@/components/shared/select-column"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Combobox } from "@/components/ui/combobox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useCrudTable } from "@/hooks/use-crud-table"
import { createTbcSchema, updateTbcSchema, type CreateTbcInput } from "@/schemas/tbc.schema"
import type { TbcRow } from "@/services/tbc.service"
import type { PaginationMeta } from "@/types/common"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Client } from "@/generated/prisma/client"
import type { ColumnDef } from "@tanstack/react-table"
import { Loader2, Plus } from "lucide-react"
import { useState } from "react"
import { Controller, useForm, type Resolver } from "react-hook-form"
import { toast } from "sonner"

interface TbcTableProps {
  data: TbcRow[]
  meta: PaginationMeta
  clients: Client[]
  filterClients: Client[]
}

const SORTABLE_COLUMNS = ["name", "link", "notRequiredLicense", "status"]

export function TbcTable({ data, meta, clients, filterClients }: TbcTableProps) {
  const { router, searchParams, deleteDialog, setDeleteDialog, editDialog, setEditDialog, pushParams, handleDelete, handleToggleStatus, sort, onSortChange } =
    useCrudTable<TbcRow>({
      deleteAction: deleteTbc,
      restoreAction: restoreTbc,
      setStatusAction: setTbcStatus,
      deleteSuccessMessage: "TBC excluído com sucesso",
      restoreSuccessMessage: "TBC restaurado com sucesso",
    })
  const [loading, setLoading] = useState(false)
  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")
  const [noLicenseFilter, setNoLicenseFilter] = useState(searchParams.get("notRequiredLicense") || "")
  const [changePassword, setChangePassword] = useState(false)

  const form = useForm<CreateTbcInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateTbcSchema : createTbcSchema) as Resolver<CreateTbcInput>,
    values: editDialog.entity
      ? {
          clientId: editDialog.entity.clientId,
          name: editDialog.entity.name,
          link: editDialog.entity.link,
          user: editDialog.entity.user,
          password: "",
          notRequiredLicense: editDialog.entity.notRequiredLicense,
          status: editDialog.entity.status,
        }
      : { clientId: "", name: "", link: "", user: "", password: "", notRequiredLicense: false, status: true },
  })

  async function onSubmit(data: CreateTbcInput) {
    if (editDialog.entity && changePassword && !data.password) {
      form.setError("password", { message: "Senha é obrigatória" })
      return
    }
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity ? await updateTbc(editDialog.entity.id, formData) : await createTbc(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "TBC atualizado" : "TBC criado")
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
    setChangePassword(false)
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<TbcRow>[] = [
    createSelectColumn<TbcRow>(),
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
      accessorKey: "notRequiredLicense",
      header: "Não consumir licença",
      cell: ({ row }) => {
        const value = row.getValue("notRequiredLicense") as boolean
        return (
          <Badge className={value ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100"}>
            {value ? "Sim" : "Não"}
          </Badge>
        )
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
          onToggleStatus={() => handleToggleStatus(row.original.id, row.original.status)}
          isActive={row.original.status}
        />
      ),
    },
  ]

  const newDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) {
          form.reset()
          setChangePassword(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="h-4 w-4 mr-2" /> Novo TBC
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar TBC" : "Novo TBC"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="notRequiredLicense"
                  render={({ field }) => (
                    <>
                      <Checkbox
                        id="notRequiredLicense"
                        checked={field.value ?? false}
                        onCheckedChange={(value) => field.onChange(!!value)}
                      />
                      <Label htmlFor="notRequiredLicense">Não consumir licença</Label>
                    </>
                  )}
                />
              </div>
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <>
                      <Checkbox
                        id="status"
                        checked={field.value ?? true}
                        onCheckedChange={(value) => field.onChange(!!value)}
                      />
                      <Label htmlFor="status">{field.value ? "Ativado" : "Desativado"}</Label>
                    </>
                  )}
                />
              </div>
            </div>
            <Field>
              <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
              <Combobox
                items={clients.map((client) => ({ value: client.id, label: client.name }))}
                value={form.watch("clientId")}
                onValueChange={(v) => form.setValue("clientId", v, { shouldValidate: true })}
                placeholder="Selecione um cliente"
                searchPlaceholder="Buscar cliente..."
                emptyText="Nenhum cliente encontrado."
                aria-invalid={!!form.formState.errors.clientId}
              />
              <FieldError errors={[form.formState.errors.clientId]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="name">TBC</FieldLabel>
              <Input
                id="name"
                className="w-full"
                {...form.register("name")}
                placeholder="Nome do TBC"
                aria-invalid={!!form.formState.errors.name}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="link">Link</FieldLabel>
              <Input
                id="link"
                className="w-full"
                {...form.register("link")}
                placeholder="https://tbc.exemplo.com"
                aria-invalid={!!form.formState.errors.link}
              />
              <FieldError errors={[form.formState.errors.link]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="user">Usuário</FieldLabel>
              <Input
                id="user"
                className="w-full"
                {...form.register("user")}
                placeholder="Usuário de acesso"
                aria-invalid={!!form.formState.errors.user}
              />
              <FieldError errors={[form.formState.errors.user]} />
            </Field>
            {editDialog.entity && !changePassword ? (
              <Field>
                <FieldLabel>Senha</FieldLabel>
                <Button type="button" variant="outline" className="w-fit" onClick={() => setChangePassword(true)}>
                  Alterar senha
                </Button>
              </Field>
            ) : (
              <Field>
                <FieldLabel htmlFor="password">{editDialog.entity ? "Nova Senha" : "Senha"}</FieldLabel>
                <Input
                  id="password"
                  className="w-full"
                  type="password"
                  {...form.register("password")}
                  placeholder={editDialog.entity ? "Digite a nova senha" : "Senha de acesso"}
                  aria-invalid={!!form.formState.errors.password}
                />
                <FieldError errors={[form.formState.errors.password]} />
              </Field>
            )}
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

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushParams({
          clientId: clientFilter || undefined,
          status: statusFilter || undefined,
          notRequiredLicense: noLicenseFilter || undefined,
          page: 1,
        })
      }
      onClear={() => {
        setClientFilter("")
        setStatusFilter("")
        setNoLicenseFilter("")
        pushParams({ clientId: undefined, status: undefined, notRequiredLicense: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Clientes</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...filterClients.map((c) => ({ value: c.id, label: c.name }))]}
          value={clientFilter || "all"}
          onValueChange={(v) => setClientFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {filterClients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Ativo</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Utiliza métodos sem licenças</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Sim" },
            { value: "false", label: "Não" },
          ]}
          value={noLicenseFilter || "all"}
          onValueChange={(v) => setNoLicenseFilter(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Sim</SelectItem>
            <SelectItem value="false">Não</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="TBCs" description="Gerenciar TBCs" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome ou link..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={{
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteTbcs,
          onSuccess: () => router.refresh(),
        }}
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
