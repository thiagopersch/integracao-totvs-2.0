"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { TruncatedText } from "@/components/shared/truncated-text"
import { ColorBadge } from "@/components/shared/color-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
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
import { deleteDepartment, createDepartment, updateDepartment, bulkDeleteDepartments } from "@/actions/departments"
import { createDepartmentSchema, updateDepartmentSchema, type CreateDepartmentInput } from "@/schemas/department.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { DepartmentWithLinks } from "@/services/department.service"
import type { RequesterOption } from "@/services/requester.service"
import type { ClientSelectOption } from "@/components/shared/client-select"
import { MultiSelect } from "@/components/ui/multi-select"
import { randomColor } from "@/lib/colors"
import type { PaginationMeta } from "@/types/common"

type Department = DepartmentWithLinks

interface DepartmentTableProps {
  data: Department[]
  meta: PaginationMeta
  clients: ClientSelectOption[]
  requesters: RequesterOption[]
}

const SORTABLE_COLUMNS = ["name", "description"]

export function DepartmentTable({ data, meta, clients, requesters }: DepartmentTableProps) {
  const {
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    sort,
    onSortChange,
    refresh,
    isPending,
  } = useCrudTable<Department>({
    deleteAction: deleteDepartment,
    deleteSuccessMessage: "Departamento excluído com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const canCreate = useHasPermission("departments", "create")
  const canUpdate = useHasPermission("departments", "update")
  const canDelete = useHasPermission("departments", "delete")
  const [loading, setLoading] = useState(false)
  const [newColor, setNewColor] = useState(randomColor)
  const [clientFilter, setClientFilter] = useState<string[]>(() => (searchParams.get("clientId") || "").split(",").filter(Boolean))

  const form = useForm<CreateDepartmentInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateDepartmentSchema : createDepartmentSchema) as Resolver<CreateDepartmentInput>,
    values: editDialog.entity
      ? {
          name: editDialog.entity.name,
          description: editDialog.entity.description || "",
          color: editDialog.entity.color,
          clientIds: editDialog.entity.departmentClients.map((dc) => dc.client.id),
          requesterIds: editDialog.entity.departmentRequesters.map((dr) => dr.requester.id),
        }
      : { name: "", description: "", color: newColor, clientIds: [], requesterIds: [] },
  })
  const clientIds = form.watch("clientIds") || []
  const selectedClients = new Set(clientIds)
  const clientRequesters = requesters.filter((r) => r.clientId && selectedClients.has(r.clientId))

  function handleClientsChange(values: string[]) {
    const previousFirst = form.getValues("clientIds")?.[0]
    form.setValue("clientIds", values, { shouldValidate: true })
    // Each requester belongs to one client: keep only those of the clients still picked.
    const selected = new Set(values)
    const allowed = new Set(requesters.filter((r) => r.clientId && selected.has(r.clientId)).map((r) => r.id))
    const current = form.getValues("requesterIds") || []
    form.setValue("requesterIds", current.filter((id) => allowed.has(id)), { shouldValidate: form.formState.isSubmitted })
    // Starts from the first client's color (only when that one changes, so adding more clients keeps it);
    // the color field stays editable.
    const first = clients.find((c) => c.id === values[0])
    if (first && first.id !== previousFirst) form.setValue("color", first.color, { shouldDirty: true })
  }

  async function onSubmit(data: CreateDepartmentInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((v) => formData.append(key, v))
      else if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateDepartment(editDialog.entity.id, formData)
      : await createDepartment(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Departamento atualizado" : "Departamento criado")
      form.reset()
      setEditDialog({ open: false })
      refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  function handleCancel() {
    form.reset()
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<Department>[] = useMemo(() => {
    const columns: ColumnDef<Department>[] = [
    createSelectColumn<Department>(),
    { accessorKey: "name", header: "Nome", cell: ({ row }) => <ColorBadge label={row.original.name} color={row.original.color} /> },
    {
      id: "client",
      header: "Cliente",
      cell: ({ row }) =>
        row.original.departmentClients.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.departmentClients.map(({ client }) => (
              <ColorBadge key={client.id} label={client.name} color={client.color} />
            ))}
          </div>
        ) : (
          "-"
        ),
    },
    {
      id: "requesters",
      header: "Solicitantes",
      cell: ({ row }) =>
        row.original.departmentRequesters.length ? (
          <div className="flex flex-wrap gap-1">
            {row.original.departmentRequesters.map(({ requester }) => (
              <ColorBadge key={requester.id} label={requester.name} color={requester.color} />
            ))}
          </div>
        ) : (
          "-"
        ),
    },
    {
      accessorKey: "description",
      header: "Descrição",
      cell: ({ row }) => <TruncatedText text={(row.getValue("description") as string) || "-"} />,
    },
  ]

  const actionsColumn: ColumnDef<Department> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
      />
    ),
  }
    if (canUpdate || canDelete) columns.push(actionsColumn)
    return columns
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog])

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (open && !editDialog.entity) setNewColor(randomColor()); if (!open) form.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Departamento</Button>} />
      <DialogContent className="h-auto max-h-[85vh] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Departamento" : "Novo Departamento"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do departamento" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="clientIds">Clientes</FieldLabel>
            <MultiSelect
              items={clients.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
              value={clientIds}
              onValueChange={handleClientsChange}
              placeholder="Selecione os clientes"
              searchPlaceholder="Buscar cliente..."
              emptyText="Nenhum cliente encontrado."
              className={form.formState.errors.clientIds ? "border-destructive" : undefined}
            />
            <FieldError errors={[form.formState.errors.clientIds]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="requesterIds">Solicitantes</FieldLabel>
            <MultiSelect
              items={clientRequesters.map((r) => ({ value: r.id, label: r.name, color: r.color }))}
              value={form.watch("requesterIds") || []}
              onValueChange={(v) => form.setValue("requesterIds", v, { shouldValidate: true })}
              placeholder={clientIds.length ? "Selecione os solicitantes" : "Selecione um cliente primeiro"}
              searchPlaceholder="Buscar solicitante..."
              emptyText="Nenhum solicitante destes clientes."
              disabled={!clientIds.length}
              className={form.formState.errors.requesterIds ? "border-destructive" : undefined}
            />
            <FieldError errors={[form.formState.errors.requesterIds]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="description">Descrição</FieldLabel>
            <Textarea id="description" {...form.register("description")} placeholder="Descrição (opcional)" />
          </Field>
          <Field>
            <FieldLabel htmlFor="color">Cor</FieldLabel>
            <Input id="color" type="color" className="h-10 p-1" style={{ width: "30%" }} {...form.register("color")} />
            <FieldError errors={[form.formState.errors.color]} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
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
      onApply={() => pushParams({ clientId: clientFilter.length ? clientFilter.join(",") : undefined, page: 1 })}
      onClear={() => {
        setClientFilter([])
        pushParams({ clientId: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Clientes</Label>
        <MultiSelect
          items={clients.map((c) => ({ value: c.id, label: c.name, color: c.color }))}
          value={clientFilter}
          onValueChange={setClientFilter}
          placeholder="Todos"
          searchPlaceholder="Buscar cliente..."
        />
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Departamentos" description="Gerenciar departamentos" />

      <DataTable
        refreshing={isPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={canCreate ? newDialog : undefined}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.name,
          action: bulkDeleteDepartments,
          onSuccess: () => refresh(),
        }}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Departamento"
        description="Tem certeza que deseja excluir este departamento? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
