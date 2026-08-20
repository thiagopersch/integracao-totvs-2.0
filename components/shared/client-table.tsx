"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { MoreHorizontal, Plus, Trash2, Pencil, Loader2, Star } from "lucide-react"
import { deleteClient, restoreClient, bulkDeleteClients, bulkRestoreClients, createClient, updateClient } from "@/actions/admin/clients"
import { createClientSchema, updateClientSchema } from "@/schemas/client.schema"
import { toast } from "sonner"
import type { Client } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface ClientTableProps {
  data: Client[]
  meta: PaginationMeta
}

export function ClientTable({ data, meta }: ClientTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; client?: Client }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  const form = useForm<any>({
    resolver: zodResolver(editDialog.client ? updateClientSchema : createClientSchema),
    values: editDialog.client
      ? {
          image: editDialog.client.image || "",
          name: editDialog.client.name,
          legalName: editDialog.client.legalName || "",
          document: editDialog.client.document || "",
          linkCrm: editDialog.client.linkCrm || "",
          site: editDialog.client.site || "",
          email: editDialog.client.email || "",
          phone: editDialog.client.phone || "",
          responsible: editDialog.client.responsible || "",
          color: editDialog.client.color,
          notes: editDialog.client.notes || "",
          favorite: editDialog.client.favorite,
          status: editDialog.client.status,
        }
      : {
          image: "",
          name: "",
          legalName: "",
          document: "",
          linkCrm: "",
          site: "",
          email: "",
          phone: "",
          responsible: "",
          color: "#22c55e",
          notes: "",
          favorite: false,
          status: true,
        },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.client
      ? await updateClient(editDialog.client.id, formData)
      : await createClient(formData)

    if (result.success) {
      toast.success(editDialog.client ? "Cliente atualizado" : "Cliente criado")
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
    const result = await deleteClient(id)
    if (result.success) {
      toast.success("Cliente excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreClient(id)
    if (result.success) {
      toast.success("Cliente restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<Client>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Selecionar todos"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Selecionar linha"
        />
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {row.original.favorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
          {row.original.name}
        </div>
      ),
    },
    { accessorKey: "linkCrm", header: "Link CRM", cell: ({ row }) => row.getValue("linkCrm") || "-" },
    { accessorKey: "document", header: "CPF/CNPJ", cell: ({ row }) => row.getValue("document") || "-" },
    { accessorKey: "email", header: "E-mail", cell: ({ row }) => row.getValue("email") || "-" },
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, client: row.original })}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => setDeleteDialog({ open: true, id: row.original.id })}
            >
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, client: open ? editDialog.client : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Novo Cliente
      </DialogTrigger>
      <DialogContent className="flex w-[70vw] min-w-[70vw] max-w-[70vw] h-[75vh] min-h-[75vh] max-h-[75vh] flex-col sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{editDialog.client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input id="name" {...form.register("name")} placeholder="Nome do cliente" aria-invalid={!!form.formState.errors.name} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="legalName">Razão Social</FieldLabel>
              <Input id="legalName" {...form.register("legalName")} placeholder="Razão social (opcional)" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="document">CPF/CNPJ</FieldLabel>
              <Input id="document" {...form.register("document")} placeholder="Documento (opcional)" aria-invalid={!!form.formState.errors.document} />
              <FieldError errors={[form.formState.errors.document]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="responsible">Responsável</FieldLabel>
              <Input id="responsible" {...form.register("responsible")} placeholder="Responsável (opcional)" />
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="email">E-mail</FieldLabel>
              <Input id="email" type="email" {...form.register("email")} placeholder="email@exemplo.com" aria-invalid={!!form.formState.errors.email} />
              <FieldError errors={[form.formState.errors.email]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="phone">Telefone</FieldLabel>
              <Input id="phone" {...form.register("phone")} placeholder="(00) 00000-0000" aria-invalid={!!form.formState.errors.phone} />
              <FieldError errors={[form.formState.errors.phone]} />
            </Field>
          </div>
          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Integração TOTVS (opcional)</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="linkCrm">Link CRM</FieldLabel>
                <Input id="linkCrm" {...form.register("linkCrm")} placeholder="https://crm.exemplo.com" />
              </Field>
              <Field>
                <FieldLabel htmlFor="site">Site</FieldLabel>
                <Input id="site" {...form.register("site")} placeholder="https://site.com.br" />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="image">URL da Imagem</FieldLabel>
              <Input id="image" {...form.register("image")} placeholder="https://exemplo.com/imagem.jpg" />
            </Field>
          </fieldset>
          <Field>
            <FieldLabel htmlFor="notes">Observações</FieldLabel>
            <Textarea id="notes" {...form.register("notes")} placeholder="Observações (opcional)" />
          </Field>
          <Field>
            <FieldLabel htmlFor="color">Cor</FieldLabel>
            <Input id="color" type="color" className="h-9 w-20 p-1" {...form.register("color")} />
          </Field>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="favorite"
                render={({ field }) => (
                  <Checkbox id="favorite" checked={field.value ?? false} onCheckedChange={(v) => field.onChange(!!v)} />
                )}
              />
              <Label htmlFor="favorite">Favorito</Label>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                control={form.control}
                name="status"
                render={({ field }) => (
                  <Checkbox id="status" checked={field.value ?? true} onCheckedChange={(v) => field.onChange(!!v)} />
                )}
              />
              <Label htmlFor="status">Cliente ativo</Label>
            </div>
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={handleCancel} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ status: statusFilter || undefined, page: 1 })}
      onClear={() => {
        setStatusFilter("")
        pushParams({ status: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Status</Label>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" || !v ? "" : v)}>
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
      <PageHeader title="Clientes" description="Gerenciar clientes (TOTVS RM e demandas)" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome, documento, e-mail ou link CRM..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Cliente"
        description="Tem certeza que deseja excluir este cliente? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
