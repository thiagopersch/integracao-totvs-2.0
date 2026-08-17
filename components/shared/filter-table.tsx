"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { MoreHorizontal, Plus, Trash2, RotateCcw, Pencil, Loader2 } from "lucide-react"
import { deleteFilter, restoreFilter, bulkDeleteFilters, bulkRestoreFilters, createFilter, updateFilter, createBackupFromFilter } from "@/actions/admin/filters"
import { listAllClients } from "@/actions/admin/clients"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { createFilterSchema, updateFilterSchema } from "@/schemas/filter.schema"
import { toast } from "sonner"
import type { Filter } from "@prisma/client"
import type { Client } from "@prisma/client"
import type { TbcRow } from "@/services/tbc.service"
import type { PaginationMeta } from "@/types/common"

interface FilterRow extends Filter {
  tbc: { id: string; name: string } | null
  client: { id: string; name: string } | null
}

interface FilterTableProps {
  data: FilterRow[]
  meta: PaginationMeta
}

export function FilterTable({ data, meta }: FilterTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; filter?: FilterRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [tbcs, setTbcs] = useState<TbcRow[]>([])

  useEffect(() => {
    listAllClients().then(setClients)
    listAllTbcs().then(setTbcs)
  }, [])

  const form = useForm<any>({
    resolver: zodResolver(editDialog.filter ? updateFilterSchema : createFilterSchema),
    values: editDialog.filter
      ? { tbcId: editDialog.filter.tbcId, clientId: editDialog.filter.clientId, filter: editDialog.filter.filter, coligateContext: editDialog.filter.coligateContext, branchContext: editDialog.filter.branchContext, levelEducationContext: editDialog.filter.levelEducationContext, codSystemContext: editDialog.filter.codSystemContext, userContext: editDialog.filter.userContext, status: editDialog.filter.status }
      : { tbcId: "", clientId: "", filter: "", coligateContext: 0, branchContext: 0, levelEducationContext: 0, codSystemContext: "", userContext: "", status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.filter
      ? await updateFilter(editDialog.filter.id, formData)
      : await createFilter(formData)

    if (result.success) {
      toast.success(editDialog.filter ? "Filtro atualizado" : "Filtro criado")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteFilter(id)
    if (result.success) {
      toast.success("Filtro excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreFilter(id)
    if (result.success) {
      toast.success("Filtro restaurado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  async function handleBackup(filterId: string) {
    const result = await createBackupFromFilter(filterId)
    if (result.success) {
      toast.success("Backup realizado com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao realizar backup")
    }
  }

  const columns: ColumnDef<FilterRow>[] = [
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
      id: "tbcName",
      header: "TBC",
      cell: ({ row }) => row.original.tbc?.name || "-",
    },
    {
      id: "clientName",
      header: "Cliente",
      cell: ({ row }) => row.original.client?.name || "-",
    },
    {
      accessorKey: "filter",
      header: "Filtro",
    },
    {
      accessorKey: "codSystemContext",
      header: "Cód. Sistema",
    },
    {
      accessorKey: "userContext",
      header: "Usuário Contexto",
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, filter: row.original })}>
              <Pencil className="h-4 w-4 mr-2" /> Editar
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleBackup(row.original.id)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Realizar Backup
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

  return (
    <>
      <PageHeader title="Filtros" description="Gerenciar filtros">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, filter: open ? editDialog.filter : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Novo Filtro
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.filter ? "Editar Filtro" : "Novo Filtro"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                <Label htmlFor="tbcId">TBC</Label>
                <Select
                  value={form.watch("tbcId") || undefined}
                  onValueChange={(v) => form.setValue("tbcId", v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um TBC" />
                  </SelectTrigger>
                  <SelectContent>
                    {tbcs.map((tbc) => (
                      <SelectItem key={tbc.id} value={tbc.id}>{tbc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.tbcId && <p className="text-sm text-destructive">{form.formState.errors.tbcId.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="clientId">Cliente</Label>
                <Select
                  value={form.watch("clientId") || undefined}
                  onValueChange={(v) => form.setValue("clientId", v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione um cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.clientId && <p className="text-sm text-destructive">{form.formState.errors.clientId.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="filter">Filtro</Label>
                <Input id="filter" className="w-full" {...form.register("filter")} placeholder="Nome do filtro" />
                {form.formState.errors.filter && <p className="text-sm text-destructive">{form.formState.errors.filter.message as string}</p>}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="coligateContext">Contexto Coligate</Label>
                  <Input id="coligateContext" className="w-full" type="number" {...form.register("coligateContext", { valueAsNumber: true })} placeholder="0" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="branchContext">Contexto Branch</Label>
                  <Input id="branchContext" className="w-full" type="number" {...form.register("branchContext", { valueAsNumber: true })} placeholder="0" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="levelEducationContext">Contexto Nível Educação</Label>
                <Input id="levelEducationContext" className="w-full" type="number" {...form.register("levelEducationContext", { valueAsNumber: true })} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codSystemContext">Código do Sistema</Label>
                <Input id="codSystemContext" className="w-full" {...form.register("codSystemContext")} placeholder="Código do sistema" />
                {form.formState.errors.codSystemContext && <p className="text-sm text-destructive">{form.formState.errors.codSystemContext.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="userContext">Usuário Contexto</Label>
                <Input id="userContext" className="w-full" {...form.register("userContext")} placeholder="Usuário de contexto" />
                {form.formState.errors.userContext && <p className="text-sm text-destructive">{form.formState.errors.userContext.message as string}</p>}
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" defaultChecked={editDialog.filter?.status ?? true} {...form.register("status")} className="rounded border-gray-300" />
                <Label htmlFor="status">Filtro ativo</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.filter ? "Atualizar" : "Criar"} Filtro
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por filtro, código ou usuário..."
        onSearch={(v) => router.push(`?search=${encodeURIComponent(v)}`)}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Filtro"
        description="Tem certeza que deseja excluir este filtro? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
