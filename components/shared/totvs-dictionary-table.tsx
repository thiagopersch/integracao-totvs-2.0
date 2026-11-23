"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, Controller, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FileSpreadsheet, FileText, FileUp, Loader2, Plus } from "lucide-react"
import { bulkDeleteDictionaryEntries, createDictionaryEntry, deleteDictionaryEntry, updateDictionaryEntry } from "@/actions/totvs-dictionary"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { PageHeader } from "@/components/shared/page-header"
import { createSelectColumn } from "@/components/shared/select-column"
import { TotvsDictionaryImportDialog } from "@/components/shared/totvs-dictionary-import-dialog"
import { TotvsDictionaryTableSelect } from "@/components/shared/totvs-dictionary-table-select"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { TABLE_DESCRIPTION_COLUMN, dictionaryKey, type DictionaryRow } from "@/lib/totvs-dictionary"
import { toast } from "@/lib/toast"
import { dictionaryEntrySchema, type DictionaryEntryInput } from "@/schemas/totvs-dictionary.schema"
import type { PaginationMeta } from "@/types/common"

type Row = DictionaryRow & { id: string }

interface TotvsDictionaryTableProps {
  data: DictionaryRow[]
  meta: PaginationMeta
  filters: { search?: string; table?: string; tablesOnly?: boolean }
}

const SORTABLE_COLUMNS = ["table", "column", "description"]

export function TotvsDictionaryTable({ data, meta, filters }: TotvsDictionaryTableProps) {
  const { deleteDialog, setDeleteDialog, editDialog, setEditDialog, pushParams, handleDelete, sort, onSortChange, refresh, isPending, optimisticRows } = useCrudTable<Row>({
    deleteAction: deleteDictionaryEntry,
    deleteSuccessMessage: "Registro excluído do dicionário",
    defaultSort: { field: "table", direction: "asc" },
  })
  const canCreate = useHasPermission("totvs_dictionary", "create")
  const canUpdate = useHasPermission("totvs_dictionary", "update")
  const canDelete = useHasPermission("totvs_dictionary", "delete")
  const [saving, setSaving] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [tableFilter, setTableFilter] = useState(filters.table ?? "")
  const [tablesOnly, setTablesOnly] = useState(!!filters.tablesOnly)

  const rows: Row[] = useMemo(() => data.map((r) => ({ ...r, id: dictionaryKey(r) })), [data])
  const editing = editDialog.entity

  const form = useForm<DictionaryEntryInput>({
    mode: "onChange",
    resolver: zodResolver(dictionaryEntrySchema) as Resolver<DictionaryEntryInput>,
    values: editing ? { table: editing.table, column: editing.column, description: editing.description } : { table: tableFilter, column: "", description: "" },
  })

  async function onSubmit(values: DictionaryEntryInput) {
    setSaving(true)
    const fd = new FormData()
    fd.append("table", values.table)
    fd.append("column", values.column)
    fd.append("description", values.description ?? "")
    const result = editing ? await updateDictionaryEntry(editing.id, fd) : await createDictionaryEntry(fd)
    setSaving(false)
    if (result.success) {
      toast.success(editing ? "Registro atualizado" : "Registro criado")
      form.reset()
      setEditDialog({ open: false })
      refresh()
    } else toast.error(result.error || "Erro ao salvar")
  }

  function exportUrl(format: "csv" | "xlsx") {
    const qs = new URLSearchParams({ format })
    if (filters.search) qs.set("search", filters.search)
    if (filters.table) qs.set("table", filters.table)
    if (filters.tablesOnly) qs.set("tablesOnly", "true")
    return `/api/totvs-dictionary/export?${qs}`
  }

  function download(format: "csv" | "xlsx") {
    const a = document.createElement("a")
    a.href = exportUrl(format)
    a.click()
    toast.success("Exportação iniciada — o arquivo será baixado em instantes")
  }

  const columns: ColumnDef<Row>[] = useMemo(() => {
    const cols: ColumnDef<Row>[] = [
      ...(canDelete ? [createSelectColumn<Row>()] : []),
      { accessorKey: "table", header: "Tabela", size: 180, cell: ({ row }) => <span className="font-mono text-sm">{row.original.table}</span> },
      {
        accessorKey: "column",
        header: "Coluna",
        size: 200,
        cell: ({ row }) =>
          row.original.column === TABLE_DESCRIPTION_COLUMN ? (
            <Badge variant="secondary">Descrição da tabela</Badge>
          ) : (
            <span className="font-mono text-sm">{row.original.column}</span>
          ),
      },
      { accessorKey: "description", header: "Descrição", minSize: 300, cell: ({ row }) => <span className="whitespace-normal">{row.original.description || "—"}</span> },
    ]
    if (canUpdate || canDelete) {
      cols.push({
        id: "actions",
        cell: ({ row }) => (
          <EntityActionsCell
            onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
            onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
          />
        ),
      })
    }
    return cols
  }, [canUpdate, canDelete, setEditDialog, setDeleteDialog])

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => pushParams({ table: tableFilter || undefined, tablesOnly: tablesOnly ? "true" : undefined, page: 1 })}
      onClear={() => {
        setTableFilter("")
        setTablesOnly(false)
        pushParams({ table: undefined, tablesOnly: undefined, page: 1 })
      }}
    >
      <Field>
        <FieldLabel htmlFor="filter-table">Tabela</FieldLabel>
        <TotvsDictionaryTableSelect id="filter-table" value={tableFilter} onChange={setTableFilter} />
      </Field>
      <label className="flex items-center gap-2 text-sm cursor-pointer self-center">
        <Switch size="sm" checked={tablesOnly} onCheckedChange={setTablesOnly} />
        Somente descrições de tabela
      </label>
    </DataTableFilterPanel>
  )

  const entryDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editing : undefined })
        if (!open) form.reset()
      }}
    >
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar registro do dicionário" : "Novo registro do dicionário"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody>
            <Field>
              <FieldLabel htmlFor="dict-table">Tabela</FieldLabel>
              <Controller
                control={form.control}
                name="table"
                render={({ field, fieldState }) => (
                  <TotvsDictionaryTableSelect id="dict-table" freeSolo value={field.value} onChange={(v) => field.onChange(v)} aria-invalid={!!fieldState.error} />
                )}
              />
              <FieldError errors={[form.formState.errors.table]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dict-column">Coluna (use # para a descrição da própria tabela)</FieldLabel>
              <Input id="dict-column" className="font-mono" {...form.register("column")} placeholder="Ex: CODCOLIGADA" aria-invalid={!!form.formState.errors.column} />
              <FieldError errors={[form.formState.errors.column]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="dict-description">Descrição</FieldLabel>
              <Textarea id="dict-description" rows={3} {...form.register("description")} placeholder="Ex: Código Identificador da Coligada" />
              <FieldError errors={[form.formState.errors.description]} />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => (form.reset(), setEditDialog({ open: false }))}>
              Cancelar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <>
      <PageHeader title="Dicionário de dados TOTVS" description={`Tabelas e campos do TOTVS RM (${meta.total.toLocaleString("pt-BR")} registros) — usados na documentação de consultas`} />

      <DataTable
        refreshing={isPending}
        columns={columns}
        data={optimisticRows(rows)}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por tabela, coluna ou descrição..."
        searchDefaultValue={filters.search}
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={
          canCreate ? (
            <Button onClick={() => setEditDialog({ open: true })}>
              <Plus className="h-4 w-4 mr-2" /> Novo registro
            </Button>
          ) : undefined
        }
        processExportActions={
          <>
            <DropdownMenuItem onClick={() => download("csv")}>
              <FileText /> Dicionário completo (.csv)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => download("xlsx")}>
              <FileSpreadsheet /> Dicionário completo (.xlsx)
            </DropdownMenuItem>
          </>
        }
        processActions={
          canCreate ? (
            <DropdownMenuItem onClick={() => setImportOpen(true)}>
              <FileUp /> Importar dicionário (.csv/.xlsx)
            </DropdownMenuItem>
          ) : undefined
        }
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        emptyMessage="Nenhum registro no dicionário. Use Processos > Importar dicionário para carregar a planilha."
        bulkDelete={
          !canDelete
            ? undefined
            : {
                getId: (row) => row.id,
                getRowLabel: (row) => `${row.table}.${row.column}`,
                action: bulkDeleteDictionaryEntries,
                onSuccess: () => refresh(),
              }
        }
      />

      {entryDialog}

      <TotvsDictionaryImportDialog open={importOpen} onOpenChange={setImportOpen} canReplace={canDelete} onImported={refresh} />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir registro do dicionário"
        description={`Excluir ${deleteDialog.id?.replace("|", ".") ?? "este registro"} do dicionário? A documentação de consultas deixará de usar esta descrição.`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
