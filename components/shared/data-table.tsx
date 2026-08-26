"use client"

import type { ColumnDef } from "@tanstack/react-table"
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type PaginationState,
} from "@tanstack/react-table"
import { Fragment, useState } from "react"
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DataTablePagination, PageSizeSelect } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { ConfirmDialog } from "./confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"

type SortState = { field: string; direction: "asc" | "desc" }

export interface BulkDeleteActionResult {
  success: boolean
  error?: string
  deletedCount?: number
  /** Rows the server refused to delete because another registry still references them, with a human-readable reason. */
  blocked?: { id: string; reasons: string }[]
}

export interface BulkDeleteConfig<TData> {
  getId: (row: TData) => string
  action: (ids: string[]) => Promise<BulkDeleteActionResult>
  /** Used to name blocked rows in the error toast; falls back to the row id. */
  getRowLabel?: (row: TData) => string
  confirmTitle?: string
  confirmDescription?: (count: number) => string
  /** Called after the delete call settles (success or partial), e.g. router.refresh(). */
  onSuccess?: () => void
}

export interface ExpandableConfig<TData> {
  isExpanded: (row: TData) => boolean
  /** Rendered as a full-width row directly below the matching row when `isExpanded` is true. */
  renderExpanded: (row: TData) => React.ReactNode
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  page?: number
  pageSize?: number
  total?: number
  pageCount?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchDefaultValue?: string
  onSearch?: (value: string) => void
  toolbarActions?: React.ReactNode
  filterPanel?: React.ReactNode
  emptyMessage?: string
  onRowClick?: (row: TData) => void
  /** Server-driven sort (backend orderBy) — separate from TanStack's client-side `sorting` state below. */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  /** Column ids (accessorKey) eligible for the clickable sort-toggle header; everything else renders unchanged. */
  sortableColumns?: string[]
  /** Enables the "excluir selecionados" flow: red toolbar button, confirm dialog with loading, and blocked-row reporting. */
  bulkDelete?: BulkDeleteConfig<TData>
  /** Renders an accordion-style detail row below a given row (e.g. child records). */
  expandable?: ExpandableConfig<TData>
}

export function DataTable<TData, TValue>({
  columns,
  data,
  page = 1,
  pageSize = 10,
  total,
  pageCount,
  onPageChange,
  onPageSizeChange,
  loading = false,
  searchable = true,
  searchPlaceholder = "Buscar...",
  searchDefaultValue = "",
  onSearch,
  toolbarActions,
  filterPanel,
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
  sort,
  onSortChange,
  sortableColumns,
  bulkDelete,
  expandable,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = useState({})
  const [internalPagination, setInternalPagination] = useState<PaginationState>({ pageIndex: 0, pageSize })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const manual = !!pageCount

  const effectivePageSize = manual ? pageSize : internalPagination.pageSize
  const effectiveOnPageSizeChange = manual
    ? (ps: number) => onPageSizeChange?.(ps)
    : (ps: number) => setInternalPagination((prev) => ({ ...prev, pageSize: ps }))

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination: manual ? { pageIndex: page - 1, pageSize } : internalPagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: manual ? undefined : setInternalPagination,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    // TanStack's getPageCount() does `table.options.pageCount ?? Math.ceil(rowCount / pageSize)` —
    // -1 is not nullish, so passing it unconditionally pinned the auto-computed (non-manual) path
    // to always report page count -1 (shown as 1 via the Math.max clamp below), permanently
    // disabling Next/Last. Only set `pageCount` at all when manual (server-driven) pagination is
    // in play; otherwise omit it so TanStack computes it from the actual row model.
    ...(manual
      ? { pageCount, manualPagination: true }
      : { getPaginationRowModel: getPaginationRowModel(), manualPagination: false }),
  })

  const selectedRows = table.getSelectedRowModel().rows
  const selectedCount = selectedRows.length

  async function handleBulkDelete() {
    if (!bulkDelete) return
    setBulkDeleting(true)
    try {
      const ids = selectedRows.map((row) => bulkDelete.getId(row.original))
      const result = await bulkDelete.action(ids)

      if (!result.success) {
        toast.error(result.error || "Erro ao excluir registros selecionados")
        return
      }

      const deletedCount = result.deletedCount ?? ids.length
      const blocked = result.blocked ?? []

      if (deletedCount > 0) {
        toast.success(`${deletedCount} registro(s) excluído(s) com sucesso`)
      }

      if (blocked.length > 0) {
        const labelFor = (id: string) => {
          const row = selectedRows.find((r) => bulkDelete.getId(r.original) === id)?.original
          return row && bulkDelete.getRowLabel ? bulkDelete.getRowLabel(row) : id
        }
        toast.error(`${blocked.length} registro(s) não puderam ser excluídos`, {
          description: blocked.map((b) => `${labelFor(b.id)}: ${b.reasons}`).join("\n"),
          duration: 10000,
        })
      }

      setRowSelection({})
      bulkDelete.onSuccess?.()
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
    }
  }

  return (
    <div className="space-y-4">
      <DataTableToolbar
        searchable={searchable}
        searchPlaceholder={searchPlaceholder}
        searchDefaultValue={searchDefaultValue}
        onSearch={onSearch}
        toolbarActions={toolbarActions}
        pageSizeSelect={<PageSizeSelect pageSize={effectivePageSize} onPageSizeChange={effectiveOnPageSizeChange} />}
        hasFilterPanel={!!filterPanel}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen((v) => !v)}
      />
      {filterPanel && filtersOpen && <div>{filterPanel}</div>}
      {bulkDelete && selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
          <span className="text-sm text-muted-foreground">{selectedCount} registro(s) selecionado(s)</span>
          <Button type="button" variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="h-4 w-4 mr-2" /> Excluir selecionados
          </Button>
        </div>
      )}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const stickyActionsClass = header.column.id === "actions" ? "sticky right-0 z-10 border-l bg-background" : undefined
                  if (header.isPlaceholder) return <TableHead key={header.id} className={stickyActionsClass} />

                  const content = flexRender(header.column.columnDef.header, header.getContext())
                  const canSort = !!onSortChange && sortableColumns?.includes(header.column.id)
                  if (!canSort) return <TableHead key={header.id} className={stickyActionsClass}>{content}</TableHead>

                  const isActive = sort?.field === header.column.id
                  const direction = isActive ? sort.direction : undefined

                  return (
                    <TableHead key={header.id} className={stickyActionsClass}>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                        onClick={() =>
                          onSortChange({
                            field: header.column.id,
                            direction: isActive && direction === "asc" ? "desc" : "asc",
                          })
                        }
                      >
                        {content}
                        {direction === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : direction === "desc" ? (
                          <ArrowDown className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
                        )}
                      </button>
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col, j) => (
                    <TableCell key={j} className={col.id === "actions" ? "sticky right-0 z-10 border-l bg-inherit" : undefined}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={cell.column.id === "actions" ? "sticky right-0 z-10 border-l bg-inherit" : undefined}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandable?.isExpanded(row.original) && (
                    <TableRow>
                      <TableCell colSpan={columns.length} className="bg-muted/30 p-0">
                        {expandable.renderExpanded(row.original)}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {manual ? (
        <DataTablePagination
          page={page}
          pageCount={pageCount!}
          total={total ?? data.length}
          onPageChange={(p) => onPageChange?.(p)}
        />
      ) : (
        <DataTablePagination
          page={table.getState().pagination.pageIndex + 1}
          pageCount={table.getPageCount()}
          total={data.length}
          onPageChange={(p) => table.setPageIndex(p - 1)}
        />
      )}
      {bulkDelete && (
        <ConfirmDialog
          open={bulkDeleteOpen}
          onOpenChange={setBulkDeleteOpen}
          title={bulkDelete.confirmTitle ?? "Excluir registros selecionados"}
          description={
            bulkDelete.confirmDescription?.(selectedCount) ??
            `Tem certeza que deseja excluir ${selectedCount} registro(s) selecionado(s)? Registros vinculados a outros cadastros não serão excluídos.`
          }
          confirmLabel="Excluir"
          loadingLabel="Excluindo..."
          variant="destructive"
          loading={bulkDeleting}
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  )
}
