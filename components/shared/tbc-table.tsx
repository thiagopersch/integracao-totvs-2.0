"use client"

import { useState, useEffect } from "react"
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
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
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
import { MoreHorizontal, Plus, Trash2, Pencil, Loader2 } from "lucide-react"
import { deleteTbc, restoreTbc, bulkDeleteTbcs, bulkRestoreTbcs, createTbc, updateTbc } from "@/actions/admin/tbcs"
import { listAllClients } from "@/actions/admin/clients"
import { createTbcSchema, updateTbcSchema } from "@/schemas/tbc.schema"
import { toast } from "sonner"
import type { PaginationMeta } from "@/types/common"
import type { TbcRow } from "@/services/tbc.service"
import type { Client } from "@prisma/client"

interface TbcTableProps {
  data: TbcRow[]
  meta: PaginationMeta
}

export function TbcTable({ data, meta }: TbcTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; tbc?: TbcRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")

  useEffect(() => {
    listAllClients().then(setClients)
  }, [])

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  const form = useForm<any>({
    resolver: zodResolver(editDialog.tbc ? updateTbcSchema : createTbcSchema),
    values: editDialog.tbc
      ? { clientId: editDialog.tbc.clientId, name: editDialog.tbc.name, link: editDialog.tbc.link, user: editDialog.tbc.user, password: "", notRequiredLicense: editDialog.tbc.notRequiredLicense, status: editDialog.tbc.status }
      : { clientId: "", name: "", link: "", user: "", password: "", notRequiredLicense: false, status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.tbc
      ? await updateTbc(editDialog.tbc.id, formData)
      : await createTbc(formData)

    if (result.success) {
      toast.success(editDialog.tbc ? "TBC atualizado" : "TBC criado")
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
    const result = await deleteTbc(id)
    if (result.success) {
      toast.success("TBC excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreTbc(id)
    if (result.success) {
      toast.success("TBC restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<TbcRow>[] = [
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
      accessorKey: "hasPassword",
      header: "Senha",
      cell: ({ row }) => {
        const has = row.getValue("hasPassword") as boolean
        return <Badge variant={has ? "default" : "secondary"}>{has ? "Configurada" : "Não configurada"}</Badge>
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
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, tbc: row.original })}>
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
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, tbc: open ? editDialog.tbc : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Novo TBC
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editDialog.tbc ? "Editar TBC" : "Novo TBC"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
            <Select
              items={clients.map((client) => ({ value: client.id, label: client.name }))}
              value={form.watch("clientId") || null}
              onValueChange={(v) => form.setValue("clientId", v || "")}
            >
              <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.clientId}>
                <SelectValue placeholder="Selecione um cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[form.formState.errors.clientId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" className="w-full" {...form.register("name")} placeholder="Nome do TBC" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="link">Link</FieldLabel>
            <Input id="link" className="w-full" {...form.register("link")} placeholder="https://tbc.exemplo.com" aria-invalid={!!form.formState.errors.link} />
            <FieldError errors={[form.formState.errors.link]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="user">Usuário</FieldLabel>
            <Input id="user" className="w-full" {...form.register("user")} placeholder="Usuário de acesso" aria-invalid={!!form.formState.errors.user} />
            <FieldError errors={[form.formState.errors.user]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="password">{editDialog.tbc ? "Nova Senha (deixe vazio para manter)" : "Senha"}</FieldLabel>
            <Input id="password" className="w-full" type="password" {...form.register("password")} placeholder={editDialog.tbc ? "Deixe vazio para manter a atual" : "Senha de acesso"} />
          </Field>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="notRequiredLicense"
              render={({ field }) => (
                <Checkbox
                  id="notRequiredLicense"
                  checked={field.value ?? false}
                  onCheckedChange={(value) => field.onChange(!!value)}
                />
              )}
            />
            <Label htmlFor="notRequiredLicense">Licença não obrigatória</Label>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox
                  id="status"
                  checked={field.value ?? true}
                  onCheckedChange={(value) => field.onChange(!!value)}
                />
              )}
            />
            <Label htmlFor="status">TBC ativo</Label>
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
      onApply={() => pushParams({ clientId: clientFilter || undefined, page: 1 })}
      onClear={() => {
        setClientFilter("")
        pushParams({ clientId: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Cliente</Label>
        <Select value={clientFilter || "all"} onValueChange={(v) => setClientFilter(v === "all" || !v ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
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
