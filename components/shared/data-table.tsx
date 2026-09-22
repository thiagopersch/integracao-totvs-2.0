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
import { Fragment, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ArrowDown, ArrowUp, ArrowUpDown, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { DataTablePagination, PageSizeSelect } from "./data-table-pagination"
import { DataTableToolbar } from "./data-table-toolbar"
import { ConfirmDialog } from "./confirm-dialog"
import { Skeleton } from "@/components/ui/skeleton"

type SortState = { field: string; direction: "asc" | "desc" }

// Above this many rows, the body switches to windowed rendering (@tanstack/react-virtual) instead
// of rendering every <tr> — most tables page at <=100 rows so this rarely engages, but the
// PAGE_SIZE_OPTIONS 50/100 choices (and any future non-paginated large dataset) benefit from it.
const VIRTUALIZE_ROW_THRESHOLD = 50
const ESTIMATED_ROW_HEIGHT = 45

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
  /** Optional slot rendered below the table and above pagination (e.g. totals/summary). */
  footer?: React.ReactNode
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
  footer,
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
  const rows = table.getRowModel().rows

  // Disabled for `expandable` tables — interleaving variable-height detail rows into the
  // virtualizer's windowing would need per-row dynamic measurement wired through a second config
  // surface for comparatively little payoff, since expandable tables tend to be smaller lists.
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const virtualizationEnabled = !loading && !expandable && rows.length > VIRTUALIZE_ROW_THRESHOLD
  const rowVirtualizer = useVirtualizer({
    count: virtualizationEnabled ? rows.length : 0,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: 10,
  })
  const virtualRows = virtualizationEnabled ? rowVirtualizer.getVirtualItems() : null

  // Real <table> layout can't reconcile absolutely-positioned virtual rows with the header's
  // auto-computed column widths, so virtualized mode switches every row (header + body) to a flex
  // row sharing this same per-column sizing — the "actions" column keeps its natural width,
  // everything else splits the remaining space evenly.
  function virtualCellStyle(columnId: string): React.CSSProperties {
    return columnId === "actions"
      ? { display: "flex", alignItems: "center", flex: "0 0 auto" }
      : { display: "flex", alignItems: "center", flex: "1 1 0%", minWidth: 0, overflow: "hidden" }
  }

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
      <div
        ref={scrollContainerRef}
        className={
          virtualizationEnabled
            ? // `<Table>`'s own wrapper div sets only `overflow-x-auto` — per the CSS overflow spec,
              // pairing an explicit axis with the other's default `visible` computes that other axis
              // to `auto` too, silently turning that div into ANOTHER scrolling ancestor. That breaks
              // the sticky header, which then sticks to that (never-scrolling) box instead of to this
              // one. Forcing it back to `overflow-visible` here restores this div as the single real
              // scroll container.
              "rounded-md border max-h-[70vh] overflow-auto [&_[data-slot=table-container]]:overflow-visible"
            : "rounded-md border"
        }
      >
        <Table style={virtualizationEnabled ? { display: "block" } : undefined}>
          {/* Sticky lives on <thead> itself, not the individual <th> cells — a <th>'s containing
              block is its immediate flex-row parent (only one row tall, so it'd have nowhere to
              stay pinned), whereas <thead>'s containing block is the full-height <table>. The
              "actions" column additionally gets its own (horizontal) sticky so it stays pinned to
              the right within that already-vertically-pinned header row. */}
          <TableHeader
            style={virtualizationEnabled ? { display: "block", position: "sticky", top: 0, zIndex: 20 } : undefined}
            className={virtualizationEnabled ? "bg-background" : undefined}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} style={virtualizationEnabled ? { display: "flex", width: "100%" } : undefined}>
                {headerGroup.headers.map((header) => {
                  const isActionsColumn = header.column.id === "actions"
                  const stickyActionsClass = isActionsColumn ? "sticky right-0 z-10 border-l bg-background" : undefined
                  const virtualStyle = virtualizationEnabled ? virtualCellStyle(header.column.id) : undefined
                  if (header.isPlaceholder) return <TableHead key={header.id} className={stickyActionsClass} style={virtualStyle} />

                  const content = flexRender(header.column.columnDef.header, header.getContext())
                  const sortEligible = sortableColumns?.includes(header.column.id)
                  if (!sortEligible)
                    return (
                      <TableHead key={header.id} className={stickyActionsClass} style={virtualStyle}>
                        {content}
                      </TableHead>
                    )

                  // Server-driven sort (sort/onSortChange passed in): caller re-fetches with the new orderBy.
                  if (onSortChange) {
                    const isActive = sort?.field === header.column.id
                    const direction = isActive ? sort.direction : undefined

                    return (
                      <TableHead key={header.id} className={stickyActionsClass} style={virtualStyle}>
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
                  }

                  // No server sort wired up: sort the already-loaded rows client-side via TanStack's own state.
                  const clientDirection = header.column.getIsSorted()

                  return (
                    <TableHead key={header.id} className={stickyActionsClass} style={virtualStyle}>
                      <button
                        type="button"
                        className="flex items-center gap-1 hover:text-foreground cursor-pointer"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {content}
                        {clientDirection === "asc" ? (
                          <ArrowUp className="h-3.5 w-3.5" />
                        ) : clientDirection === "desc" ? (
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
          <TableBody
            style={
              virtualizationEnabled
                ? { display: "block", position: "relative", height: `${rowVirtualizer.getTotalSize()}px` }
                : undefined
            }
          >
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((col, j) => (
                    <TableCell key={j} className={col.id === "actions" ? "sticky right-0 z-10 border-l bg-background" : undefined}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : !rows.length ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : virtualRows ? (
              virtualRows.map((virtualRow) => {
                const row = rows[virtualRow.index]
                return (
                  <TableRow
                    key={row.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                    style={{
                      display: "flex",
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === "actions"
                            ? "sticky right-0 z-10 border-l bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted"
                            : undefined
                        }
                        style={virtualCellStyle(cell.column.id)}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })
            ) : (
              rows.map((row) => (
                <Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && "selected"}
                    onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                    className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          cell.column.id === "actions"
                            ? "sticky right-0 z-10 border-l bg-background group-hover:bg-muted/50 group-data-[state=selected]:bg-muted"
                            : undefined
                        }
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
            )}
          </TableBody>
        </Table>
      </div>
      {footer}
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
