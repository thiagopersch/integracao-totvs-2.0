"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EditorView, basicSetup } from "codemirror"
import { EditorState } from "@codemirror/state"
import { oneDark } from "@codemirror/theme-one-dark"
import { useTheme } from "next-themes"
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
  const { theme } = useTheme()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; sentence?: SentenceRow }>({ open: false })
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState<SentenceCategory[]>([])
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("sentenceCategoryId") || "")
  const contentEditorRef = useRef<HTMLDivElement>(null)
  const contentViewRef = useRef<EditorView | null>(null)

  useEffect(() => {
    listAllSentenceCategories().then(setCategories)
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
    resolver: zodResolver(editDialog.sentence ? updateSentenceSchema : createSentenceSchema),
    values: editDialog.sentence
      ? { sentenceCategoryId: editDialog.sentence.sentenceCategoryId, code: editDialog.sentence.code, codSystem: editDialog.sentence.codSystem || "", codColigada: editDialog.sentence.codColigada || "", name: editDialog.sentence.name, content: editDialog.sentence.content || "", status: editDialog.sentence.status }
      : { sentenceCategoryId: "", code: "", codSystem: "", codColigada: "", name: "", content: "", status: true },
  })

  useEffect(() => {
    if (!editDialog.open || !contentEditorRef.current) return
    const isDark = theme === "dark"
    const state = EditorState.create({
      doc: editDialog.sentence?.content || "",
      extensions: [
        basicSetup,
        isDark ? oneDark : [],
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            form.setValue("content", update.state.doc.toString())
          }
        }),
      ],
    })

    if (contentViewRef.current) contentViewRef.current.destroy()
    contentViewRef.current = new EditorView({ state, parent: contentEditorRef.current })

    return () => {
      contentViewRef.current?.destroy()
      contentViewRef.current = null
    }
  }, [editDialog.open, editDialog.sentence, theme])

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

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, sentence: open ? editDialog.sentence : undefined }); if (!open) form.reset() }}>
      <DialogTrigger className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm font-medium hover:bg-primary/90 h-9">
        <Plus className="h-4 w-4 mr-2" /> Nova Sentença
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{editDialog.sentence ? "Editar Sentença" : "Nova Sentença"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <Field>
            <FieldLabel htmlFor="sentenceCategoryId">Categoria</FieldLabel>
            <Select
              items={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              value={form.watch("sentenceCategoryId") || null}
              onValueChange={(v) => form.setValue("sentenceCategoryId", v || "")}
            >
              <SelectTrigger className="w-full" aria-invalid={!!form.formState.errors.sentenceCategoryId}>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[form.formState.errors.sentenceCategoryId]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="code">Código</FieldLabel>
            <Input id="code" className="w-full" {...form.register("code")} placeholder="Código único" aria-invalid={!!form.formState.errors.code} />
            <FieldError errors={[form.formState.errors.code]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="name">Nome</FieldLabel>
            <Input id="name" className="w-full" {...form.register("name")} placeholder="Nome da sentença" aria-invalid={!!form.formState.errors.name} />
            <FieldError errors={[form.formState.errors.name]} />
          </Field>
          <Field>
            <FieldLabel htmlFor="content">Conteúdo</FieldLabel>
            <div
              ref={contentEditorRef}
              className="w-full min-h-[180px] rounded-lg border border-input overflow-hidden text-sm [&_.cm-editor]:h-full [&_.cm-editor]:min-h-[180px] [&_.cm-editor.cm-focused]:outline-none"
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="codSystem">Cód. Sistema</FieldLabel>
              <Input id="codSystem" className="w-full" {...form.register("codSystem")} placeholder="Código do sistema (opcional)" />
            </Field>
            <Field>
              <FieldLabel htmlFor="codColigada">Cód. Coligada</FieldLabel>
              <Input id="codColigada" className="w-full" {...form.register("codColigada")} placeholder="Código da coligada (opcional)" />
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
            <Label htmlFor="status">Sentença ativa</Label>
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
      onApply={() => pushParams({ sentenceCategoryId: categoryFilter || undefined, page: 1 })}
      onClear={() => {
        setCategoryFilter("")
        pushParams({ sentenceCategoryId: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" || !v ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader title="Sentenças" description="Gerenciar sentenças" />

      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por código ou nome..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={newDialog}
        filterPanel={filterPanel}
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
