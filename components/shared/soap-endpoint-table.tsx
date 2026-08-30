"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FieldError } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Plus, Loader2, ChevronDown, ChevronRight } from "lucide-react"
import {
  createSoapEndpointType,
  updateSoapEndpointType,
  deleteSoapEndpointType,
  createSoapEndpointMethod,
  updateSoapEndpointMethod,
  deleteSoapEndpointMethod,
} from "@/actions/admin/soap-endpoints"
import {
  createSoapEndpointTypeSchema,
  updateSoapEndpointTypeSchema,
  createSoapEndpointMethodSchema,
  updateSoapEndpointMethodSchema,
  type CreateSoapEndpointTypeInput,
  type CreateSoapEndpointMethodInput,
} from "@/schemas/soap-endpoint.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import type { SoapEndpointType, SoapEndpointMethod } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

type SoapEndpointTypeWithMethods = SoapEndpointType & { methods: SoapEndpointMethod[] }

interface SoapEndpointTableProps {
  data: SoapEndpointTypeWithMethods[]
  meta: PaginationMeta
}

const SORTABLE_COLUMNS = ["type", "label", "suffix", "active"]

export function SoapEndpointTable({ data, meta }: SoapEndpointTableProps) {
  const {
    router,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    sort,
    onSortChange,
  } = useCrudTable<SoapEndpointTypeWithMethods>({
    deleteAction: deleteSoapEndpointType,
    deleteSuccessMessage: "Tipo de endpoint excluído com sucesso",
    defaultSort: { field: "type", direction: "asc" },
  })
  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null)
  const [methodDeleteId, setMethodDeleteId] = useState<string | null>(null)
  const [methodDialog, setMethodDialog] = useState<{
    open: boolean
    endpointTypeId?: string
    method?: SoapEndpointMethod
  }>({ open: false })
  const [loading, setLoading] = useState(false)

  const typeForm = useForm<CreateSoapEndpointTypeInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateSoapEndpointTypeSchema : createSoapEndpointTypeSchema) as Resolver<CreateSoapEndpointTypeInput>,
    values: editDialog.entity
      ? {
          type: editDialog.entity.type,
          label: editDialog.entity.label,
          suffix: editDialog.entity.suffix,
          active: editDialog.entity.active,
        }
      : { type: "", label: "", suffix: "", active: true },
  })

  const methodForm = useForm<CreateSoapEndpointMethodInput>({
    mode: "onChange",
    resolver: zodResolver(methodDialog.method ? updateSoapEndpointMethodSchema : createSoapEndpointMethodSchema) as Resolver<CreateSoapEndpointMethodInput>,
    values: methodDialog.method
      ? {
          endpointTypeId: methodDialog.method.endpointTypeId,
          method: methodDialog.method.method,
          label: methodDialog.method.label,
          sortOrder: methodDialog.method.sortOrder,
          active: methodDialog.method.active,
        }
      : { endpointTypeId: methodDialog.endpointTypeId || "", method: "", label: "", sortOrder: 0, active: true },
  })

  async function onTypeSubmit(data: CreateSoapEndpointTypeInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateSoapEndpointType(editDialog.entity.id, formData)
      : await createSoapEndpointType(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Tipo de endpoint atualizado" : "Tipo de endpoint criado")
      typeForm.reset()
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function onMethodSubmit(data: CreateSoapEndpointMethodInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = methodDialog.method
      ? await updateSoapEndpointMethod(methodDialog.method.id, formData)
      : await createSoapEndpointMethod(formData)

    if (result.success) {
      toast.success(methodDialog.method ? "Método atualizado" : "Método criado")
      setMethodDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleMethodDelete(id: string) {
    const result = await deleteSoapEndpointMethod(id)
    if (result.success) {
      toast.success("Método excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setMethodDeleteId(null)
  }

  function openMethodDialog(endpointTypeId: string, method?: SoapEndpointMethod) {
    methodForm.reset({
      endpointTypeId: method?.endpointTypeId || endpointTypeId,
      method: method?.method || "",
      label: method?.label || "",
      sortOrder: method?.sortOrder || 0,
      active: method?.active ?? true,
    })
    setMethodDialog({ open: true, endpointTypeId, method })
  }

  function handleTypeCancel() {
    typeForm.reset()
    setEditDialog({ open: false })
  }

  const columns: ColumnDef<SoapEndpointTypeWithMethods>[] = [
    {
      id: "expand",
      header: "",
      cell: ({ row }) => (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="h-6 w-6"
          onClick={() => setExpandedTypeId(expandedTypeId === row.original.id ? null : row.original.id)}
        >
          {expandedTypeId === row.original.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      ),
    },
    { accessorKey: "type", header: "Tipo" },
    { accessorKey: "label", header: "Label" },
    {
      accessorKey: "suffix",
      header: "Suffix",
      cell: ({ row }) => <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{row.getValue("suffix")}</code>,
    },
    {
      accessorKey: "active",
      header: "Status",
      cell: ({ row }) => {
        const active = row.getValue("active") as boolean
        return <Badge variant={active ? "default" : "secondary"}>{active ? "Ativo" : "Inativo"}</Badge>
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
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) typeForm.reset() }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Novo Tipo</Button>} />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Tipo de Endpoint" : "Novo Tipo de Endpoint"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={typeForm.handleSubmit(onTypeSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody>
            <div className="space-y-2">
              <Label htmlFor="type">Tipo</Label>
              <Input id="type" className="w-full" {...typeForm.register("type")} placeholder="Ex: NOTAFISCAL" aria-invalid={!!typeForm.formState.errors.type} />
              <FieldError errors={[typeForm.formState.errors.type]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input id="label" className="w-full" {...typeForm.register("label")} placeholder="Ex: Nota Fiscal" aria-invalid={!!typeForm.formState.errors.label} />
              <FieldError errors={[typeForm.formState.errors.label]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="suffix">Suffix</Label>
              <Input id="suffix" className="w-full" {...typeForm.register("suffix")} placeholder="Ex: nota_fiscal" aria-invalid={!!typeForm.formState.errors.suffix} />
              <FieldError errors={[typeForm.formState.errors.suffix]} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="active"
                checked={typeForm.watch("active")}
                onCheckedChange={(v) => typeForm.setValue("active", v === true)}
              />
              <Label htmlFor="active">Tipo ativo</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={loading} onClick={handleTypeCancel}>
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
      <PageHeader title="Endpoints SOAP" description="Gerenciar tipos de endpoint e métodos SOAP" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por label, tipo ou suffix..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        emptyMessage="Nenhum tipo de endpoint encontrado."
        expandable={{
          isExpanded: (row) => row.id === expandedTypeId,
          renderExpanded: (endpointType) => (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-sm font-medium">Métodos</h4>
                <Button size="sm" variant="outline" onClick={() => openMethodDialog(endpointType.id)}>
                  <Plus className="h-3 w-3 mr-1" /> Novo Método
                </Button>
              </div>
              {endpointType.methods.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum método cadastrado para este tipo.</p>
              ) : (
                <div className="rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Método</TableHead>
                        <TableHead>Label</TableHead>
                        <TableHead>Ordem</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...endpointType.methods]
                        .sort((a, b) => a.sortOrder - b.sortOrder)
                        .map((method) => (
                          <TableRow key={method.id}>
                            <TableCell className="font-medium">{method.method}</TableCell>
                            <TableCell>{method.label}</TableCell>
                            <TableCell>{method.sortOrder}</TableCell>
                            <TableCell>
                              <Badge variant={method.active ? "default" : "secondary"}>
                                {method.active ? "Ativo" : "Inativo"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <EntityActionsCell
                                onEdit={() => openMethodDialog(endpointType.id, method)}
                                onDelete={() => setMethodDeleteId(method.id)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ),
        }}
      />

      <Dialog
        open={methodDialog.open}
        onOpenChange={(open) => {
          setMethodDialog({ open, endpointTypeId: open ? methodDialog.endpointTypeId : undefined, method: open ? methodDialog.method : undefined })
          if (!open) methodForm.reset()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{methodDialog.method ? "Editar Método" : "Novo Método"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={methodForm.handleSubmit(onMethodSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <DialogBody>
              <input type="hidden" {...methodForm.register("endpointTypeId")} />
              <div className="space-y-2">
                <Label htmlFor="method">Método</Label>
                <Input id="method" className="w-full" {...methodForm.register("method")} placeholder="Ex: GETSCHEMA" aria-invalid={!!methodForm.formState.errors.method} />
                <FieldError errors={[methodForm.formState.errors.method]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="methodLabel">Label</Label>
                <Input id="methodLabel" className="w-full" {...methodForm.register("label")} placeholder="Ex: Obter Schema" aria-invalid={!!methodForm.formState.errors.label} />
                <FieldError errors={[methodForm.formState.errors.label]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sortOrder">Ordem</Label>
                <Input
                  id="sortOrder"
                  type="number"
                  className="w-full"
                  {...methodForm.register("sortOrder", { valueAsNumber: true })}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="methodActive"
                  checked={methodForm.watch("active")}
                  onCheckedChange={(v) => methodForm.setValue("active", v === true)}
                />
                <Label htmlFor="methodActive">Método ativo</Label>
              </div>
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={() => { methodForm.reset(); setMethodDialog({ open: false }) }}
              >
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

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Tipo de Endpoint"
        description="Tem certeza que deseja excluir este tipo de endpoint? Os métodos associados também serão desativados."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />

      <ConfirmDialog
        open={!!methodDeleteId}
        onOpenChange={(open) => !open && setMethodDeleteId(null)}
        title="Excluir Método"
        description="Tem certeza que deseja excluir este método? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => methodDeleteId && handleMethodDelete(methodDeleteId)}
      />
    </>
  )
}
