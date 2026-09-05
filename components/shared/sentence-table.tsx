"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { cn } from "@/utils/cn"
import { CodeEditor } from "@/components/shared/code-editor"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { TruncatedText } from "@/components/shared/truncated-text"
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
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"
import { deleteSentence, restoreSentence, createSentence, updateSentence, bulkDeleteSentences, setSentenceStatus } from "@/actions/admin/sentences"
import { createSentenceSchema, updateSentenceSchema, type CreateSentenceInput } from "@/schemas/sentence.schema"
import { toast } from "sonner"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import type { Sentence } from "@/generated/prisma/client"
import type { SentenceCategory } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SentenceRow extends Sentence {
  category: { id: string; name: string } | null
}

interface SentenceTableProps {
  data: SentenceRow[]
  meta: PaginationMeta
  categories: SentenceCategory[]
}

const SORTABLE_COLUMNS = ["code", "name", "codSystem", "status"]

export function SentenceTable({ data, meta, categories }: SentenceTableProps) {
  const {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    handleDelete,
    handleToggleStatus,
    sort,
    onSortChange,
  } = useCrudTable<SentenceRow>({
    deleteAction: deleteSentence,
    restoreAction: restoreSentence,
    setStatusAction: setSentenceStatus,
    deleteSuccessMessage: "Sentença excluída com sucesso",
    restoreSuccessMessage: "Sentença restaurada com sucesso",
    defaultSort: { field: "name", direction: "asc" },
  })
  const canCreate = useHasPermission("sentences", "create")
  const canUpdate = useHasPermission("sentences", "update")
  const canDelete = useHasPermission("sentences", "delete")
  const [loading, setLoading] = useState(false)
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get("sentenceCategoryId") || "")
  const [fullscreen, setFullscreen] = useState(false)

  const form = useForm<CreateSentenceInput>({
    mode: "onChange",
    resolver: zodResolver(editDialog.entity ? updateSentenceSchema : createSentenceSchema) as Resolver<CreateSentenceInput>,
    values: editDialog.entity
      ? { sentenceCategoryId: editDialog.entity.sentenceCategoryId, code: editDialog.entity.code, codSystem: editDialog.entity.codSystem || "", codColigada: editDialog.entity.codColigada || "", name: editDialog.entity.name, content: editDialog.entity.content || "", status: editDialog.entity.status }
      : { sentenceCategoryId: "", code: "", codSystem: "", codColigada: "", name: "", content: "", status: true },
  })

  async function onSubmit(data: CreateSentenceInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (value !== undefined) formData.append(key, String(value))
    })

    const result = editDialog.entity
      ? await updateSentence(editDialog.entity.id, formData)
      : await createSentence(formData)

    if (result.success) {
      toast.success(editDialog.entity ? "Sentença atualizada" : "Sentença criada")
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
    setFullscreen(false)
  }

  const columns: ColumnDef<SentenceRow>[] = [
    createSelectColumn<SentenceRow>(),
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
      cell: ({ row }) => <TruncatedText text={row.original.name} />,
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
  ]

  const actionsColumn: ColumnDef<SentenceRow> = {
    id: "actions",
    cell: ({ row }) => (
      <EntityActionsCell
        onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
        onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
        onToggleStatus={canUpdate ? () => handleToggleStatus(row.original.id, row.original.status) : undefined}
        isActive={row.original.status}
      />
    ),
  }
  if (canUpdate || canDelete) columns.push(actionsColumn)

  const newDialog = (
    <Dialog open={editDialog.open} onOpenChange={(open) => { setEditDialog({ open, entity: open ? editDialog.entity : undefined }); if (!open) { form.reset(); setFullscreen(false) } }}>
      <DialogTrigger render={<Button><Plus className="h-4 w-4 mr-2" /> Nova Sentença</Button>} />
      <DialogContent
        className={cn(
          "transition-[width,height]",
          fullscreen && "h-[95vh]! max-h-[95vh]! w-[95vw]! max-w-[95vw]!"
        )}
      >
        <DialogHeader>
          <DialogTitle>{editDialog.entity ? "Editar Sentença" : "Nova Sentença"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <DialogBody className="flex flex-col overflow-x-hidden overflow-y-hidden">
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
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="codColigada">Cód. Coligada</FieldLabel>
              <Input id="codColigada" className="w-full" maxLength={5} {...form.register("codColigada")} placeholder="Código da coligada (opcional)" aria-invalid={!!form.formState.errors.codColigada} />
              <FieldError errors={[form.formState.errors.codColigada]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="codSystem">Cód. Sistema</FieldLabel>
              <Input id="codSystem" className="w-full" maxLength={2} {...form.register("codSystem")} placeholder="Código do sistema (opcional)" aria-invalid={!!form.formState.errors.codSystem} />
              <FieldError errors={[form.formState.errors.codSystem]} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="code">Código</FieldLabel>
              <Input id="code" className="w-full" maxLength={16} {...form.register("code")} placeholder="Código único" aria-invalid={!!form.formState.errors.code} />
              <FieldError errors={[form.formState.errors.code]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="name">Nome</FieldLabel>
              <Input id="name" className="w-full" maxLength={255} {...form.register("name")} placeholder="Nome da sentença" aria-invalid={!!form.formState.errors.name} />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>
          </div>
          <Field className="min-h-0 flex-1">
            <FieldLabel htmlFor="content">Conteúdo</FieldLabel>
            <CodeEditor
              value={editDialog.entity?.content ?? ""}
              onChange={(v) => form.setValue("content", v)}
              language="sql"
              resetKey={editDialog.entity?.id ?? "new"}
              fullscreen={fullscreen}
              onFullscreenChange={setFullscreen}
              minHeight="160px"
              containerClassName="flex min-h-0 flex-1 flex-col"
              className="min-h-0 flex-1"
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={loading} className="w-full sm:w-auto">Cancelar</Button>
          <Button type="submit" disabled={loading} className="w-full sm:w-auto">
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
      onApply={() => pushParams({ sentenceCategoryId: categoryFilter || undefined, page: 1 })}
      onClear={() => {
        setCategoryFilter("")
        pushParams({ sentenceCategoryId: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Categoria</Label>
        <Select
          items={[{ value: "all", label: "Todas" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
          value={categoryFilter || "all"}
          onValueChange={(v) => setCategoryFilter(v === "all" || !v ? "" : v)}
        >
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
      <PageHeader title="Sentenças Padrões" description="Gerenciar sentenças padrões" />

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
        toolbarActions={canCreate ? newDialog : undefined}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={!canDelete ? undefined : {
          getId: (row) => row.id,
          getRowLabel: (row) => row.code,
          action: bulkDeleteSentences,
          onSuccess: () => router.refresh(),
        }}
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
