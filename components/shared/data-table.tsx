"use client"

import type { ColumnDef } from "@tanstack/react-table"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import {
  DataGrid,
  ColumnsPanelTrigger,
  FilterPanelTrigger,
  Toolbar,
  ToolbarButton,
  useGridApiRef,
  gridFilteredSortedRowEntriesSelector,
  gridVisibleColumnDefinitionsSelector,
  type GridApi as GridApiCommunity,
  type GridColDef,
  type GridPaginationModel,
  type GridRenderCellParams,
  type GridRowSelectionModel,
  type GridSortModel,
  type GridSortDirection,
} from "@mui/x-data-grid"
import { ptBR } from "@mui/x-data-grid/locales"
import Badge from "@mui/material/Badge"
import Tooltip from "@mui/material/Tooltip"
import { ChevronDown, Columns3, FileDown, FileSpreadsheet, FileText, ListFilter, Trash2, Workflow } from "lucide-react"
import { toast } from "@/lib/toast"
import { exportRowsAsPdf, exportRowsAsXlsx, type ExportFormat } from "@/lib/table-export"
import { Button } from "@/components/ui/button"
import { DataTableToolbar } from "./data-table-toolbar"
import { ConfirmDialog } from "./confirm-dialog"
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

/**
 * Optional per-column layout hints (TanStack `meta`), read by the DataGrid adapter below.
 * Columns default to `flex: 1, minWidth: 140`; the `actions` column to a fixed width.
 */
declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- must match TanStack's generic signature
  interface ColumnMeta<TData, TValue> {
    width?: number
    minWidth?: number
    flex?: number
    align?: "left" | "right" | "center"
    /** Plain value for columns that only render a cell (badges, links): used by CSV/Excel export and client search. */
    exportValue?: (row: TData) => unknown
  }
}

type SortState = { field: string; direction: "asc" | "desc" }

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const LOCALE_TEXT = ptBR.components.MuiDataGrid.defaultProps.localeText
/** Clicks on these never trigger `onRowClick` (actions ⋯, checkbox, links, inputs). */
const INTERACTIVE_SELECTOR =
  "button, a, input, label, select, textarea, [role=checkbox], [role=menuitem], [role=menu], [data-no-row-click]"
const DETAIL_SUFFIX = "::detail"

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
  /** Extra content inside the confirm dialog (e.g. what the selected rows are linked to). */
  confirmContent?: (rows: TData[]) => React.ReactNode
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
  /** New data is being fetched for rows already on screen: the grid shows its skeleton overlay. */
  refreshing?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  searchDefaultValue?: string
  /** Server search. Without it, the search box drives the grid's own quick filter (client data). */
  onSearch?: (value: string) => void
  toolbarActions?: React.ReactNode
  /** Extra `DropdownMenuItem`s (e.g. imports) shown in the toolbar's "Processos" menu under "Importar". */
  processActions?: React.ReactNode
  /** Extra `DropdownMenuItem`s (e.g. a page-specific report) shown in the "Processos" menu after CSV/Excel/PDF. */
  processExportActions?: React.ReactNode
  /** Takes over the menu's CSV/Excel/PDF items (e.g. to ask which fields to export); without it the grid exports its visible columns. */
  onExport?: (format: ExportFormat) => void
  filterPanel?: React.ReactNode
  emptyMessage?: string
  onRowClick?: (row: TData) => void
  /** Right-click menu of a row: returns a `ContextMenuContent`. */
  rowContextMenu?: (row: TData) => React.ReactNode
  /** Server-driven sort (backend orderBy). */
  sort?: SortState
  onSortChange?: (sort: SortState) => void
  /** With `onSortChange`: the columns the backend can order by. Ignored for client data (every column sorts). */
  sortableColumns?: string[]
  /** Enables the "excluir selecionados" flow: checkbox selection, confirm dialog and blocked-row reporting. */
  bulkDelete?: BulkDeleteConfig<TData>
  /** Extra buttons in the selection bar (e.g. bulk edit); `clearSelection` unselects every row. */
  bulkActions?: (rows: TData[], clearSelection: () => void) => React.ReactNode
  /** Renders a full-width detail row below a given row (e.g. child records). */
  expandable?: ExpandableConfig<TData>
  /** Optional slot rendered below the table (e.g. totals/summary). */
  footer?: React.ReactNode
}

/** Internal grid row: the caller's object plus a stable id and its position in `data`. */
type GridRow<TData> = { __id: string; __index: number; __original: TData; __detail?: boolean }

type AnyColumn<TData> = ColumnDef<TData, unknown> & {
  accessorKey?: string
  accessorFn?: (row: TData, index: number) => unknown
}

function columnId<TData>(col: AnyColumn<TData>): string {
  return col.id ?? String(col.accessorKey ?? "")
}

function readPath(obj: unknown, path: string): unknown {
  let cur = obj
  for (const key of path.split(".")) {
    if (cur == null) return undefined
    cur = (cur as Record<string, unknown>)[key]
  }
  return cur
}

function defaultRowKey(row: unknown, index: number): string {
  const id = (row as { id?: unknown } | null)?.id
  return id == null ? `row-${index}` : String(id)
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return -1
  if (b == null) return 1
  if (typeof a === "number" && typeof b === "number") return a - b
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" })
}

/** Toolbar rendered inside the grid: the app's search/filter/actions plus the grid's own tools. */
type ToolbarSlotProps = {
  searchable: boolean
  searchPlaceholder: string
  searchDefaultValue: string
  onSearch: (value: string) => void
  toolbarActions?: React.ReactNode
  hasFilterPanel: boolean
  filtersOpen: boolean
  onToggleFilters: () => void
  columnFilters: boolean
  apiRef: React.RefObject<GridApiCommunity | null>
  processActions?: React.ReactNode
  processExportActions?: React.ReactNode
  onExport?: (format: ExportFormat) => void
  /** The page's filter box, shown between the toolbar row and the column headers while open. */
  filterPanel?: React.ReactNode
}

function exportFileName() {
  // e.g. /operations/demands → "operations-demands-2026-11-22"
  const path = typeof window === "undefined" ? "" : window.location.pathname
  const base = path.split("/").filter(Boolean).join("-").replace(/[^\w-]+/g, "-")
  return `${base || "export"}-${new Date().toISOString().slice(0, 10)}`
}

/** The grid's visible columns and filtered/sorted rows (formatted values), as shown on screen. */
function collectExportRows(apiRef: React.RefObject<GridApiCommunity | null>) {
  const api = apiRef.current
  if (!api) return null
  const columns = gridVisibleColumnDefinitionsSelector(apiRef as React.RefObject<GridApiCommunity>).filter(
    (c) => !c.disableExport && c.field !== "__check__"
  )
  const entries = gridFilteredSortedRowEntriesSelector(apiRef as React.RefObject<GridApiCommunity>).filter(
    (e) => !(e.model as { __detail?: boolean }).__detail
  )
  const headers = columns.map((c) => c.headerName || c.field)
  const rows = entries.map((entry) =>
    columns.map((col) => {
      const value = api.getRowFormattedValue(entry.model, col)
      return value instanceof Date ? value : value == null ? "" : typeof value === "object" ? String(value) : value
    })
  )
  return { headers, rows }
}

/** Writes the grid's visible columns and filtered/sorted rows to an .xlsx file (formatted values). */
async function exportExcel(apiRef: React.RefObject<GridApiCommunity | null>) {
  const data = collectExportRows(apiRef)
  if (!data) return
  await exportRowsAsXlsx(data, exportFileName())
}

/** Same rows as the Excel export, laid out as a landscape PDF table. */
async function exportPdf(apiRef: React.RefObject<GridApiCommunity | null>, title: string) {
  const data = collectExportRows(apiRef)
  if (!data) return
  await exportRowsAsPdf(data, exportFileName(), title)
}

function ProcessesMenu({
  apiRef,
  processActions,
  processExportActions,
  onExport,
}: Pick<ToolbarSlotProps, "apiRef" | "processActions" | "processExportActions" | "onExport">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button type="button" variant="outline" size="sm" className="h-9" />}>
        <Workflow className="mr-2 h-4 w-4" /> Processos <ChevronDown className="ml-1 h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-52">
        <DropdownMenuLabel>Exportar</DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() =>
            onExport ? onExport("csv") : apiRef.current?.exportDataAsCsv({ utf8WithBom: true, delimiter: ";", fileName: exportFileName() })
          }
        >
          <FileText /> Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (onExport) return onExport("xlsx")
            exportExcel(apiRef).catch(() => toast.error("Erro ao exportar Excel"))
          }}
        >
          <FileSpreadsheet /> Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            if (onExport) return onExport("pdf")
            // The page header names the table better than the (app-wide) document title.
            const title = document.querySelector("main h1, h1")?.textContent?.trim() || "Relatório"
            exportPdf(apiRef, title).catch(() => toast.error("Erro ao exportar PDF"))
          }}
        >
          <FileDown /> Exportar PDF
        </DropdownMenuItem>
        {processExportActions}
        {processActions && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Importar</DropdownMenuLabel>
            {processActions}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function DataTableGridToolbar(props: Partial<ToolbarSlotProps>) {
  const p = props as ToolbarSlotProps
  const gridTools = (
    <div className="flex items-center gap-1">
      <Tooltip title="Colunas">
        <ColumnsPanelTrigger render={<ToolbarButton />}>
          <Columns3 className="size-4" />
        </ColumnsPanelTrigger>
      </Tooltip>
      {p.columnFilters && (
        <Tooltip title="Filtros">
          <FilterPanelTrigger
            render={(triggerProps, state) => (
              <ToolbarButton {...triggerProps} color="default">
                <Badge badgeContent={state.filterCount} color="primary" variant="dot">
                  <ListFilter className="size-4" />
                </Badge>
              </ToolbarButton>
            )}
          />
        </Tooltip>
      )}
      <ProcessesMenu apiRef={p.apiRef} processActions={p.processActions} processExportActions={p.processExportActions} onExport={p.onExport} />
    </div>
  )
  return (
    <Toolbar style={{ display: "block", flex: "0 0 auto", minHeight: 0, padding: 8 }}>
      <DataTableToolbar
        searchable={p.searchable}
        searchPlaceholder={p.searchPlaceholder}
        searchDefaultValue={p.searchDefaultValue}
        onSearch={p.onSearch}
        toolbarActions={p.toolbarActions}
        pageSizeSelect={gridTools}
        hasFilterPanel={p.hasFilterPanel}
        filtersOpen={p.filtersOpen}
        onToggleFilters={p.onToggleFilters}
      />
      {p.filterPanel && <div className="mt-2">{p.filterPanel}</div>}
    </Toolbar>
  )
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
  refreshing = false,
  searchable = true,
  searchPlaceholder = "Buscar...",
  searchDefaultValue = "",
  onSearch,
  toolbarActions,
  processActions,
  processExportActions,
  onExport,
  filterPanel,
  emptyMessage = "Nenhum registro encontrado.",
  onRowClick,
  rowContextMenu,
  sort,
  onSortChange,
  sortableColumns,
  bulkDelete,
  bulkActions,
  expandable,
  footer,
}: DataTableProps<TData, TValue>) {
  const apiRef = useGridApiRef()
  const manual = !!pageCount
  const serverSort = manual && !!onSortChange
  // Detail rows are interleaved by hand, so an expandable table sorts/paginates its rows itself.
  const selfManaged = !manual && !!expandable
  const selectable = !!(bulkDelete || bulkActions)

  // The filter box starts closed and closes again whenever the route changes. With cacheComponents
  // Next keeps visited pages alive in <Activity>, so leaving and coming back would otherwise show it
  // still open: the layout-effect cleanup runs when the page is hidden (and on a pathname change in
  // a table kept mounted across routes). See next/dist/docs/.../preserving-ui-state.md.
  const pathname = usePathname()
  const [filtersOpen, setFiltersOpen] = useState(false)
  useLayoutEffect(() => () => setFiltersOpen(false), [pathname])
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [selection, setSelection] = useState<GridRowSelectionModel>({ type: "include", ids: new Set() })
  const [clientPagination, setClientPagination] = useState<GridPaginationModel>({ page: 0, pageSize })
  const [clientSort, setClientSort] = useState<GridSortModel>([])
  const [menuRow, setMenuRow] = useState<TData | null>(null)
  // The row handler runs before the menu trigger's (bubbling): the ref is readable synchronously.
  const menuRowRef = useRef<TData | null>(null)

  const onRowClickRef = useRef(onRowClick)
  useEffect(() => {
    onRowClickRef.current = onRowClick
  })

  const cols = columns as unknown as AnyColumn<TData>[]
  const getters = useMemo(() => {
    const map = new Map<string, (row: TData, index: number) => unknown>()
    for (const col of cols) {
      const id = columnId(col)
      if (col.accessorFn) map.set(id, col.accessorFn)
      else if (col.accessorKey) {
        const key = String(col.accessorKey)
        map.set(id, (row) => readPath(row, key))
      }
    }
    return map
  }, [cols])

  const rowKey = useCallback(
    (row: TData, index: number) => (bulkDelete ? bulkDelete.getId(row) : defaultRowKey(row, index)),
    [bulkDelete]
  )

  // ── Rows ────────────────────────────────────────────────────────────────────
  const baseRows = useMemo<GridRow<TData>[]>(
    () => data.map((original, index) => ({ __id: rowKey(original, index), __index: index, __original: original })),
    [data, rowKey]
  )
  const byId = useMemo(() => new Map(baseRows.map((r) => [r.__id, r])), [baseRows])

  const rows = useMemo<GridRow<TData>[]>(() => {
    if (!selfManaged || !expandable) return baseRows
    let list = baseRows
    const s = clientSort[0]
    const getter = s ? getters.get(s.field) : undefined
    if (s && getter) {
      const dir = s.sort === "desc" ? -1 : 1
      list = [...list].sort((a, b) => dir * compareValues(getter(a.__original, a.__index), getter(b.__original, b.__index)))
    }
    const start = clientPagination.page * clientPagination.pageSize
    const pageRows = list.slice(start, start + clientPagination.pageSize)
    return pageRows.flatMap((r) =>
      expandable.isExpanded(r.__original) ? [r, { ...r, __id: r.__id + DETAIL_SUFFIX, __detail: true }] : [r]
    )
  }, [selfManaged, expandable, baseRows, clientSort, getters, clientPagination])

  // ── Columns ─────────────────────────────────────────────────────────────────
  const gridColumns = useMemo<GridColDef<GridRow<TData>>[]>(() => {
    const visible = cols.filter((c) => columnId(c) !== "select")
    const detailSpan = visible.length
    return visible.map((col, colIndex) => {
      const id = columnId(col)
      const isActions = id === "actions"
      const getter = getters.get(id)
      const meta = col.meta ?? {}
      const sortable = isActions
        ? false
        : serverSort
          ? !!sortableColumns?.includes(id)
          : col.enableSorting !== false
      const def: GridColDef<GridRow<TData>> = {
        field: id || `col-${colIndex}`,
        headerName: typeof col.header === "string" ? col.header : "",
        sortable,
        filterable: !isActions && !manual && !selfManaged,
        hideable: !isActions,
        disableColumnMenu: isActions,
        disableExport: isActions,
        align: meta.align ?? (isActions ? "right" : "left"),
        headerAlign: meta.align ?? (isActions ? "right" : "left"),
        ...(isActions
          ? { width: meta.width ?? 96, minWidth: meta.minWidth ?? 64 }
          : meta.width
            ? { width: meta.width, minWidth: meta.minWidth ?? 60 }
            : { flex: meta.flex ?? 1, minWidth: meta.minWidth ?? 140 }),
        valueGetter: (_value, row) => {
          if (row.__detail) return undefined
          if (getter) return getter(row.__original, row.__index)
          return meta.exportValue?.(row.__original)
        },
        colSpan: (_value, row) => (row.__detail ? (colIndex === 0 ? detailSpan : 1) : 1),
        renderCell: (params: GridRenderCellParams<GridRow<TData>>) => {
          const row = params.row
          if (row.__detail) return colIndex === 0 && expandable ? <div className="w-full py-2">{expandable.renderExpanded(row.__original)}</div> : null
          if (col.cell == null) return params.value == null ? "" : String(params.value)
          if (typeof col.cell !== "function") return col.cell
          // Minimal TanStack CellContext shim: callers read `row.original` / `row.getValue(key)`.
          const ctx = {
            getValue: () => params.value,
            renderValue: () => params.value,
            row: {
              id: row.__id,
              index: row.__index,
              original: row.__original,
              getValue: (key: string) => getters.get(key)?.(row.__original, row.__index),
            },
            column: { id },
            cell: { id: `${row.__id}_${id}` },
            table: {},
          }
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shim of TanStack's CellContext
          return (col.cell as (ctx: any) => React.ReactNode)(ctx)
        },
      }
      if (typeof col.header === "function") {
        const header = col.header
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shim of TanStack's HeaderContext
        def.renderHeader = () => (header as (ctx: any) => React.ReactNode)({ column: { id }, header: { id }, table: {} })
      }
      return def
    })
  }, [cols, getters, serverSort, sortableColumns, manual, selfManaged, expandable])

  // ── Sorting / pagination models ─────────────────────────────────────────────
  // Memoized by value: a new array each render makes the grid publish `sortModelChange`, which
  // resets pagination to the first page (next-page clicks snapped back to page 1). Fields that
  // aren't grid columns (e.g. a default `updatedAt` order) are left out: the grid would strip them
  // and report an empty model, which looked like a user sort change and looped the URL.
  const columnFields = useMemo(() => new Set(gridColumns.map((c) => c.field)), [gridColumns])
  const sortField = sort?.field
  const sortDirection = sort?.direction
  const sortIsColumn = !!sortField && columnFields.has(sortField)
  const serverSortModel = useMemo<GridSortModel>(
    () => (sortIsColumn && sortField ? [{ field: sortField, sort: sortDirection as GridSortDirection }] : []),
    [sortIsColumn, sortField, sortDirection]
  )
  const sortModel: GridSortModel | undefined = serverSort ? serverSortModel : selfManaged ? clientSort : undefined

  const serverPagination = useMemo<GridPaginationModel>(() => ({ page: page - 1, pageSize }), [page, pageSize])
  const paginationModel: GridPaginationModel = manual ? serverPagination : clientPagination

  const handlePagination = useCallback(
    (model: GridPaginationModel) => {
      if (!manual) {
        setClientPagination(model)
        return
      }
      if (model.pageSize !== pageSize) onPageSizeChange?.(model.pageSize)
      else if (model.page !== page - 1) onPageChange?.(model.page + 1)
    },
    [manual, page, pageSize, onPageChange, onPageSizeChange]
  )

  const handleSort = useCallback(
    (model: GridSortModel) => {
      if (serverSort) {
        const next = model[0]
        // Nothing sorted on screen (backend default order on a non-column field): nothing to flip.
        if (!next && !sortIsColumn) return
        // The backend always has an order; clearing the sort just flips back to ascending.
        onSortChange?.(
          next
            ? { field: next.field, direction: next.sort === "desc" ? "desc" : "asc" }
            : { field: sort?.field ?? "", direction: sort?.direction === "asc" ? "desc" : "asc" }
        )
      } else if (selfManaged) setClientSort(model)
    },
    [serverSort, selfManaged, onSortChange, sort, sortIsColumn]
  )

  // ── Search ──────────────────────────────────────────────────────────────────
  const handleSearch = useCallback(
    (value: string) => {
      if (onSearch) onSearch(value)
      else apiRef.current?.setQuickFilterValues(value.split(/\s+/).filter(Boolean))
    },
    [onSearch, apiRef]
  )
  const toggleFilters = useCallback(() => setFiltersOpen((v) => !v), [])

  // ── Selection ───────────────────────────────────────────────────────────────
  const selectedRows = useMemo(() => {
    const ids = selection.ids
    if (selection.type === "exclude") return baseRows.filter((r) => !ids.has(r.__id)).map((r) => r.__original)
    return [...ids].map((id) => byId.get(String(id))?.__original).filter((r): r is TData => r !== undefined)
  }, [selection, baseRows, byId])
  const selectedCount = selectedRows.length
  const clearSelection = useCallback(() => setSelection({ type: "include", ids: new Set() }), [])

  async function handleBulkDelete() {
    if (!bulkDelete) return
    setBulkDeleting(true)
    try {
      const ids = selectedRows.map((row) => bulkDelete.getId(row))
      const result = await bulkDelete.action(ids)
      if (!result.success) {
        toast.error(result.error || "Erro ao excluir registros selecionados")
        return
      }
      const deletedCount = result.deletedCount ?? ids.length
      const blocked = result.blocked ?? []
      if (deletedCount > 0) toast.success(`${deletedCount} registro(s) excluído(s) com sucesso`)
      if (blocked.length > 0) {
        const labelFor = (id: string) => {
          const row = selectedRows.find((r) => bulkDelete.getId(r) === id)
          return row && bulkDelete.getRowLabel ? bulkDelete.getRowLabel(row) : id
        }
        toast.error(`${blocked.length} registro(s) não puderam ser excluídos`, {
          description: blocked.map((b) => `${labelFor(b.id)}: ${b.reasons}`).join("\n"),
          duration: 10000,
        })
      }
      clearSelection()
      bulkDelete.onSuccess?.()
    } finally {
      setBulkDeleting(false)
      setBulkDeleteOpen(false)
    }
  }

  // ── Row interactions ────────────────────────────────────────────────────────
  const rowFromEvent = useCallback(
    (target: HTMLElement): GridRow<TData> | undefined => {
      const id = target.closest<HTMLElement>(".MuiDataGrid-row")?.dataset.id
      return id ? byId.get(id.replace(DETAIL_SUFFIX, "")) : undefined
    },
    [byId]
  )

  const toolbarProps: ToolbarSlotProps = {
    searchable,
    searchPlaceholder,
    searchDefaultValue,
    onSearch: handleSearch,
    toolbarActions,
    hasFilterPanel: !!filterPanel,
    filtersOpen,
    onToggleFilters: toggleFilters,
    columnFilters: !manual && !selfManaged,
    apiRef,
    processActions,
    processExportActions,
    onExport,
    filterPanel: filtersOpen ? filterPanel : undefined,
  }

  const grid = (
    <DataGrid<GridRow<TData>>
      apiRef={apiRef}
      rows={rows}
      columns={gridColumns}
      getRowId={(r) => r.__id}
      localeText={{ ...LOCALE_TEXT, noRowsLabel: emptyMessage, noResultsOverlayLabel: emptyMessage }}
      loading={loading || refreshing}
      showToolbar
      slots={{ toolbar: DataTableGridToolbar as never }}
      slotProps={{
        toolbar: toolbarProps as never,
        loadingOverlay: { variant: "skeleton", noRowsVariant: "skeleton" },
        pagination: { showFirstButton: true, showLastButton: true },
        row: {
          onContextMenu: rowContextMenu
            ? (event: React.MouseEvent<HTMLElement>) => {
                menuRowRef.current = rowFromEvent(event.currentTarget)?.__original ?? null
                setMenuRow(menuRowRef.current)
              }
            : undefined,
        },
      }}
      // Pagination
      pagination
      paginationMode={manual || selfManaged ? "server" : "client"}
      rowCount={manual ? (total ?? data.length) : selfManaged ? data.length : undefined}
      paginationModel={paginationModel}
      onPaginationModelChange={handlePagination}
      pageSizeOptions={PAGE_SIZE_OPTIONS}
      // Sorting / filtering
      sortingMode={serverSort || selfManaged ? "server" : "client"}
      sortModel={sortModel}
      onSortModelChange={handleSort}
      filterMode="client"
      disableColumnFilter={manual || selfManaged}
      // Selection
      checkboxSelection={selectable}
      keepNonExistentRowsSelected={manual}
      rowSelectionModel={selection}
      onRowSelectionModelChange={setSelection}
      isRowSelectable={(p) => !p.row.__detail}
      disableRowSelectionOnClick
      // Layout
      getRowHeight={() => "auto"}
      getRowClassName={(p) => (p.row.__detail ? "data-table-detail-row" : onRowClick ? "data-table-clickable-row" : "")}
      onRowClick={(params, event) => {
        if (params.row.__detail || !onRowClickRef.current) return
        if ((event.target as HTMLElement).closest(INTERACTIVE_SELECTOR)) return
        onRowClickRef.current(params.row.__original)
      }}
      disableVirtualization={!!expandable}
      // No room reserved for scrollbars: they're hidden below, the rows still scroll (wheel, trackpad, touch, keys).
      scrollbarSize={0}
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        bgcolor: "background.paper",
        "--DataGrid-containerBackground": "transparent",
        "& .MuiDataGrid-columnHeaderTitle": {
          fontSize: "0.7rem",
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: "text.secondary",
        },
        "& .MuiDataGrid-cell": { py: 1, display: "flex", alignItems: "center" },
        "& .MuiDataGrid-cell:focus, & .MuiDataGrid-cell:focus-within, & .MuiDataGrid-columnHeader:focus, & .MuiDataGrid-columnHeader:focus-within":
          { outline: "none" },
        "& .data-table-clickable-row": { cursor: "pointer" },
        "& .data-table-detail-row, & .data-table-detail-row:hover": { bgcolor: "action.hover" },
        "& .MuiTablePagination-actions .MuiIconButton-root": { width: 32, height: 32, borderRadius: "50%" },
        "& .MuiDataGrid-scrollbar, & .MuiDataGrid-scrollbarFiller": { display: "none" },
        "& .MuiDataGrid-virtualScroller": { scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } },
      }}
    />
  )

  return (
    <div className="space-y-4">
      {selectable && selectedCount > 0 && (
        <div className="flex items-center justify-between rounded-lg bg-destructive/8 px-4 py-2">
          <span className="text-sm text-muted-foreground">{selectedCount} registro(s) selecionado(s)</span>
          <div className="flex items-center gap-2">
            {bulkActions?.(selectedRows, clearSelection)}
            {bulkDelete && (
              <Button type="button" variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" /> Excluir selecionados
              </Button>
            )}
          </div>
        </div>
      )}
      <div aria-busy={refreshing || loading || undefined} className="flex flex-col">
        {rowContextMenu ? (
          <ContextMenu
            onOpenChange={(open, details) => {
              if (open && !menuRowRef.current) details.cancel()
              if (!open) {
                menuRowRef.current = null
                setMenuRow(null)
              }
            }}
          >
            <ContextMenuTrigger render={<div />}>{grid}</ContextMenuTrigger>
            {menuRow && rowContextMenu(menuRow)}
          </ContextMenu>
        ) : (
          grid
        )}
      </div>
      {footer}
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
        >
          {bulkDeleteOpen && bulkDelete.confirmContent?.(selectedRows)}
        </ConfirmDialog>
      )}
    </div>
  )
}
