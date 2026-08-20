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
import { MoreHorizontal, Plus, Trash2, RotateCcw, Pencil, Loader2 } from "lucide-react"
import { deleteFilter, restoreFilter, bulkDeleteFilters, bulkRestoreFilters, createFilter, updateFilter, createBackupFromFilter } from "@/actions/admin/filters"
import { listAllClients } from "@/actions/admin/clients"
import { listAllTbcs } from "@/actions/admin/tbcs"
import { listAllSistemas } from "@/actions/admin/sistemas"
import { createFilterSchema, updateFilterSchema } from "@/schemas/filter.schema"
import { toast } from "sonner"
import type { Filter, TotvsSystem } from "@prisma/client"
import type { Client } from "@prisma/client"
import type { TbcRow } from "@/services/tbc.service"
import type { PaginationMeta } from "@/types/common"

const DEFAULT_FILTER_VALUE = "CODSENTENCA LIKE 'RB%'"

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
  const [sistemas, setSistemas] = useState<TotvsSystem[]>([])
  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")

  useEffect(() => {
    listAllClients().then(setClients)
    listAllTbcs().then(setTbcs)
    listAllSistemas().then(setSistemas)
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
    resolver: zodResolver(editDialog.filter ? updateFilterSchema : createFilterSchema),
    values: editDialog.filter
      ? {
          clientId: editDialog.filter.clientId,
          tbcId: editDialog.filter.tbcId,
          filter: editDialog.filter.filter,
          coligateContext: editDialog.filter.coligateContext,
          branchContext: editDialog.filter.branchContext,
          levelEducationContext: editDialog.filter.levelEducationContext,
          codSystemContext: editDialog.filter.codSystemContext,
          userContext: editDialog.filter.userContext,
          codColigadaSentenca: editDialog.filter.codColigadaSentenca || "",
          codSistemaSentenca: editDialog.filter.codSistemaSentenca || "",
          status: editDialog.filter.status,
        }
      : {
          clientId: "",
          tbcId: "",
          filter: DEFAULT_FILTER_VALUE,
          coligateContext: 0,
          branchContext: 0,
          levelEducationContext: 0,
          codSystemContext: "",
          userContext: "",
          codColigadaSentenca: "",
          codSistemaSentenca: "",
          status: true,
        },
  })

  const selectedClientId = form.watch("clientId")
  const availableTbcs = tbcs.filter((t) => t.clientId === selectedClientId)

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
      id: "clientName",
      header: "Cliente",
      cell: ({ row }) => row.original.client?.name || "-",
    },
    {
      id: "tbcName",
      header: "TBC",
      cell: ({ row }) => row.original.tbc?.name || "-",
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

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, filter: open ? editDialog.filter : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Novo Filtro
      </DialogTrigger>
      <DialogContent className="flex w-[70vw] min-w-[70vw] max-w-[70vw] h-[70vh] min-h-[70vh] max-h-[70vh] flex-col sm:max-w-none">
        <DialogHeader>
          <DialogTitle>{editDialog.filter ? "Editar Filtro" : "Novo Filtro"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 space-y-4 overflow-y-auto pr-1">
          <Field>
            <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
            <Select
              items={clients.map((client) => ({ value: client.id, label: client.name }))}
              value={form.watch("clientId") || null}
              onValueChange={(v) => {
                form.setValue("clientId", v || "")
                const currentTbcId = form.getValues("tbcId")
                const stillValid = tbcs.find((t) => t.id === currentTbcId && t.clientId === v)
                if (!stillValid) form.setValue("tbcId", "")
              }}
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
            <FieldLabel htmlFor="tbcId">TBC</FieldLabel>
            <Select
              items={availableTbcs.map((tbc) => ({ value: tbc.id, label: `${tbc.client?.name ?? ""} | ${tbc.link} | ${tbc.user}` }))}
              value={form.watch("tbcId") || null}
              onValueChange={(v) => form.setValue("tbcId", v || "")}
              disabled={!selectedClientId}
            >
              <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.tbcId}>
                <SelectValue placeholder={selectedClientId ? "Selecione um TBC" : "Selecione um cliente primeiro"} />
              </SelectTrigger>
              <SelectContent>
                {availableTbcs.map((tbc) => (
                  <SelectItem key={tbc.id} value={tbc.id}>{tbc.client?.name ?? ""} | {tbc.link} | {tbc.user}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[form.formState.errors.tbcId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="filter">Filtro</FieldLabel>
            <Input id="filter" className="w-full" {...form.register("filter")} placeholder="Nome do filtro" aria-invalid={!!form.formState.errors.filter} />
            <FieldError errors={[form.formState.errors.filter]} />
          </Field>

          <fieldset className="space-y-3 rounded-lg border border-input p-3">
            <legend className="px-1 text-sm font-medium text-muted-foreground">Contexto</legend>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <Field>
                <FieldLabel htmlFor="coligateContext">CODCOLIGADA</FieldLabel>
                <Input id="coligateContext" className="w-full" type="number" {...form.register("coligateContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="branchContext">CODFILIAL</FieldLabel>
                <Input id="branchContext" className="w-full" type="number" {...form.register("branchContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="levelEducationContext">CODTIPOCURSO</FieldLabel>
                <Input id="levelEducationContext" className="w-full" type="number" {...form.register("levelEducationContext", { valueAsNumber: true })} placeholder="0" />
              </Field>
              <Field>
                <FieldLabel htmlFor="codSystemContext">CODSISTEMA</FieldLabel>
                <Input id="codSystemContext" className="w-full" {...form.register("codSystemContext")} placeholder="Código do sistema" aria-invalid={!!form.formState.errors.codSystemContext} />
                <FieldError errors={[form.formState.errors.codSystemContext]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="userContext">CODUSUARIO</FieldLabel>
                <Input id="userContext" className="w-full" {...form.register("userContext")} placeholder="Usuário de contexto" aria-invalid={!!form.formState.errors.userContext} />
                <FieldError errors={[form.formState.errors.userContext]} />
              </Field>
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="codColigadaSentenca">Cód. Coligada Sentença</FieldLabel>
              <Input
                id="codColigadaSentenca"
                className="w-full"
                maxLength={5}
                inputMode="numeric"
                {...form.register("codColigadaSentenca")}
                placeholder="00001"
                aria-invalid={!!form.formState.errors.codColigadaSentenca}
              />
              <FieldError errors={[form.formState.errors.codColigadaSentenca]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="codSistemaSentenca">Cód. Sistema Sentença</FieldLabel>
              <Select
                items={sistemas.map((s) => ({ value: s.code, label: `${s.code} - ${s.internalName} (${s.externalName})` }))}
                value={form.watch("codSistemaSentenca") || null}
                onValueChange={(v) => form.setValue("codSistemaSentenca", v || "")}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Selecione um sistema" />
                </SelectTrigger>
                <SelectContent>
                  {sistemas.map((s) => (
                    <SelectItem key={s.id} value={s.code}>{s.code} - {s.internalName} ({s.externalName})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
            <Label htmlFor="status">Filtro ativo</Label>
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
      <PageHeader title="Filtros" description="Gerenciar filtros" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por filtro, código ou usuário..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
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
