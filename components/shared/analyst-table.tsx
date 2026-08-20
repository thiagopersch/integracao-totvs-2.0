"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Field, FieldLabel, FieldError } from "@/components/ui/field"
import { Checkbox } from "@/components/ui/checkbox"
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
import { deleteAnalyst, createAnalyst, updateAnalyst } from "@/actions/analysts"
import { createAnalystSchema, updateAnalystSchema } from "@/schemas/analyst.schema"
import { toast } from "sonner"
import type { Analyst } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface AnalystTableProps {
  data: Analyst[]
  meta: PaginationMeta
}

export function AnalystTable({ data, meta }: AnalystTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; analyst?: Analyst }>({ open: false })
  const [loading, setLoading] = useState(false)

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  const form = useForm<any>({
    resolver: zodResolver(editDialog.analyst ? updateAnalystSchema : createAnalystSchema),
    values: editDialog.analyst
      ? {
          name: editDialog.analyst.name,
          email: editDialog.analyst.email || "",
          phone: editDialog.analyst.phone || "",
          role: editDialog.analyst.role || "",
          hourlyRate: editDialog.analyst.hourlyRate ?? undefined,
          team: editDialog.analyst.team || "",
          color: editDialog.analyst.color,
          level: editDialog.analyst.level,
          status: editDialog.analyst.status,
        }
      : { name: "", email: "", phone: "", role: "", hourlyRate: undefined, team: "", color: "#6366f1", level: 1, status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.analyst
      ? await updateAnalyst(editDialog.analyst.id, formData)
      : await createAnalyst(formData)

    if (result.success) {
      toast.success(editDialog.analyst ? "Analista atualizado" : "Analista criado")
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
    const result = await deleteAnalyst(id)
    if (result.success) {
      toast.success("Analista excluído com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  const columns: ColumnDef<Analyst>[] = [
    {
      accessorKey: "name",
      header: "Nome",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: row.original.color }} />
          {row.original.name}
        </div>
      ),
    },
    { accessorKey: "role", header: "Cargo", cell: ({ row }) => row.getValue("role") || "-" },
    { accessorKey: "team", header: "Time", cell: ({ row }) => row.getValue("team") || "-" },
    { accessorKey: "level", header: "Nível" },
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, analyst: row.original })}>
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
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, analyst: open ? editDialog.analyst : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Novo Analista
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{editDialog.analyst ? "Editar Analista" : "Novo Analista"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" {...form.register("name")} placeholder="Nome do analista" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
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
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="role">Cargo</FieldLabel>
              <Input id="role" {...form.register("role")} placeholder="Ex: Analista" />
            </Field>
            <Field>
              <FieldLabel htmlFor="team">Time</FieldLabel>
              <Input id="team" {...form.register("team")} placeholder="Ex: Suporte" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Field>
              <FieldLabel htmlFor="hourlyRate">Valor/hora</FieldLabel>
              <Input id="hourlyRate" type="number" step="0.01" {...form.register("hourlyRate")} placeholder="0.00" aria-invalid={!!form.formState.errors.hourlyRate} />
              <FieldError errors={[form.formState.errors.hourlyRate]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="level">Nível</FieldLabel>
              <Input id="level" type="number" min={1} {...form.register("level")} aria-invalid={!!form.formState.errors.level} />
              <FieldError errors={[form.formState.errors.level]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="color">Cor</FieldLabel>
              <Input id="color" type="color" className="h-9 w-full p-1" {...form.register("color")} />
            </Field>
          </div>
          <div className="flex items-center gap-2">
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Checkbox id="status" checked={field.value ?? true} onCheckedChange={(v) => field.onChange(!!v)} />
              )}
            />
            <Label htmlFor="status">Analista ativo</Label>
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

  return (
    <>
      <PageHeader title="Analistas" description="Gerenciar analistas" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por nome ou e-mail..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Analista"
        description="Tem certeza que deseja excluir este analista? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
