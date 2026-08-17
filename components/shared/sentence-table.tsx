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
import { deleteSentence, restoreSentence, bulkDeleteSentences, bulkRestoreSentences, createSentence, updateSentence } from "@/actions/admin/sentences"
import { listAllSentenceCategories } from "@/actions/admin/sentence-categories"
import { createSentenceSchema, updateSentenceSchema } from "@/schemas/sentence.schema"
import { toast } from "sonner"
import type { Sentence } from "@prisma/client"
import type { SentenceCategory } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SentenceRow extends Sentence {
  category: { id: string; name: string } | null
}

interface SentenceTableProps {
  data: SentenceRow[]
  meta: PaginationMeta
}

export function SentenceTable({ data, meta }: SentenceTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; sentence?: SentenceRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<SentenceCategory[]>([])

  useEffect(() => {
    listAllSentenceCategories().then(setCategories)
  }, [])

  const form = useForm<any>({
    resolver: zodResolver(editDialog.sentence ? updateSentenceSchema : createSentenceSchema),
    values: editDialog.sentence
      ? { sentenceCategoryId: editDialog.sentence.sentenceCategoryId, code: editDialog.sentence.code, codSystem: editDialog.sentence.codSystem || "", name: editDialog.sentence.name, content: editDialog.sentence.content || "", status: editDialog.sentence.status }
      : { sentenceCategoryId: "", code: "", codSystem: "", name: "", content: "", status: true },
  })

  async function onSubmit(data: any) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.sentence
      ? await updateSentence(editDialog.sentence.id, formData)
      : await createSentence(formData)

    if (result.success) {
      toast.success(editDialog.sentence ? "Sentença atualizada" : "Sentença criada")
      setEditDialog({ open: false })
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    const result = await deleteSentence(id)
    if (result.success) {
      toast.success("Sentença excluída com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    const result = await restoreSentence(id)
    if (result.success) {
      toast.success("Sentença restaurada com sucesso")
      router.refresh()
    } else {
      toast.error(result.error || "Erro ao restaurar")
    }
  }

  const columns: ColumnDef<SentenceRow>[] = [
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
      id: "categoryName",
      header: "Categoria",
      cell: ({ row }) => row.original.category?.name || "-",
    },
    {
      accessorKey: "code",
      header: "Código",
    },
    {
      accessorKey: "name",
      header: "Nome",
    },
    {
      accessorKey: "codSystem",
      header: "Cód. Sistema",
      cell: ({ row }) => row.getValue("codSystem") || "-",
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
            <DropdownMenuItem onClick={() => setEditDialog({ open: true, sentence: row.original })}>
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

  return (
    <>
      <PageHeader title="Sentenças" description="Gerenciar sentenças">
        <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, sentence: open ? editDialog.sentence : undefined }); if (!open) form.reset() }}>
          <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" /> Nova Sentença
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{editDialog.sentence ? "Editar Sentença" : "Nova Sentença"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sentenceCategoryId">Categoria</Label>
                <Select
                  value={form.watch("sentenceCategoryId") || undefined}
                  onValueChange={(v) => form.setValue("sentenceCategoryId", v || "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.sentenceCategoryId && <p className="text-sm text-destructive">{form.formState.errors.sentenceCategoryId.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="code">Código</Label>
                <Input id="code" className="w-full" {...form.register("code")} placeholder="Código único" />
                {form.formState.errors.code && <p className="text-sm text-destructive">{form.formState.errors.code.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input id="name" className="w-full" {...form.register("name")} placeholder="Nome da sentença" />
                {form.formState.errors.name && <p className="text-sm text-destructive">{form.formState.errors.name.message as string}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo</Label>
                <textarea
                  id="content"
                  className="w-full min-h-[120px] rounded-lg border border-input bg-transparent px-3 py-2 text-sm font-mono transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 placeholder:text-muted-foreground"
                  {...form.register("content")}
                  placeholder="Conteúdo da sentença"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="codSystem">Cód. Sistema</Label>
                <Input id="codSystem" className="w-full" {...form.register("codSystem")} placeholder="Código do sistema (opcional)" />
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="status" defaultChecked={editDialog.sentence?.status ?? true} {...form.register("status")} className="rounded border-gray-300" />
                <Label htmlFor="status">Sentença ativa</Label>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editDialog.sentence ? "Atualizar" : "Criar"} Sentença
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <DataTable
        columns={columns}
        data={data}
        pageCount={meta.totalPages}
        searchPlaceholder="Buscar por código ou nome..."
        onSearch={(v) => router.push(`?search=${encodeURIComponent(v)}`)}
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Sentença"
        description="Tem certeza que deseja excluir esta sentença? Esta ação pode ser revertida posteriormente."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
