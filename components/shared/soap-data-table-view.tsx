"use client"

// Memoized: the SOAP builder re-renders on every keystroke in its editors; result tables (thousands
// of rows) only re-render when the result changes.

import { memo, useRef } from "react"
import { Badge } from "@/components/ui/badge"
import { VirtualRows, VIRTUALIZE_AT } from "@/components/shared/virtual-rows"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TableCellValue } from "@/components/shared/table-cell-value"
import type { DataTable } from "@/utils/soap-schema"

interface SoapDataTableViewProps {
  tables: DataTable[]
}

/** Renders an actual ReadView result — same overview-badges + per-table sections layout as
 *  SoapSchemaView (its GetSchema counterpart), just showing real row values under dynamic,
 *  data-driven columns instead of fixed field-metadata columns. */
export const SoapDataTableView = memo(function SoapDataTableView({ tables }: SoapDataTableViewProps) {
  if (!tables.length) {
    return (
      <p className="text-muted-foreground text-sm p-4">
        Nenhum registro retornado — veja a aba XML para o retorno bruto.
      </p>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {tables.length === 1 ? "Tabela encontrada:" : `Tabelas encontradas (${tables.length}):`}
        </span>
        {tables.map((table) => (
          <a key={table.name} href={`#data-table-${table.name}`}>
            <Badge variant="outline" className="cursor-pointer hover:bg-accent">
              {table.name} ({table.rows.length})
            </Badge>
          </a>
        ))}
      </div>

      {tables.map((table) => (
        <DataTableSection key={table.name} table={table} />
      ))}
    </div>
  )
})

/** One result table. ReadViews can return thousands of rows: past VIRTUALIZE_AT only the rows on
 *  screen are rendered, inside a scroll box with a sticky header. */
function DataTableSection({ table }: { table: DataTable }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualize = table.rows.length >= VIRTUALIZE_AT
  const renderRow = (index: number) => {
    const row = table.rows[index]
    return (
      <TableRow key={index}>
        {table.columns.map((column) => (
          <TableCell key={column} className="font-mono text-xs whitespace-nowrap">
            <TableCellValue value={row[column] ?? ""} />
          </TableCell>
        ))}
      </TableRow>
    )
  }
  return (
    <div id={`data-table-${table.name}`} className="scroll-mt-4 space-y-2">
      <h3 className="font-heading text-sm font-semibold">
        {table.name} <span className="font-normal text-muted-foreground">({table.rows.length} registro(s))</span>
      </h3>
      <ScrollArea
        ref={scrollRef}
        className={virtualize ? "max-h-[65vh] rounded-lg border border-input" : "rounded-lg border border-input"}
      >
        <Table>
          <TableHeader className={virtualize ? "sticky top-0 z-10 bg-background" : undefined}>
            <TableRow>
              {table.columns.map((column) => (
                <TableHead key={column} className="font-mono text-xs whitespace-nowrap">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {table.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={table.columns.length || 1} className="text-center text-sm text-muted-foreground">
                  Não há valor informado para esta tabela
                </TableCell>
              </TableRow>
            ) : virtualize ? (
              <VirtualRows
                count={table.rows.length}
                scrollRef={scrollRef}
                renderRow={renderRow}
                renderSpacer={(height, key) => (
                  <tr key={key} aria-hidden style={{ height }}>
                    <td colSpan={table.columns.length || 1} style={{ padding: 0, border: 0 }} />
                  </tr>
                )}
              />
            ) : (
              table.rows.map((_, index) => renderRow(index))
            )}
          </TableBody>
        </Table>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  )
}
