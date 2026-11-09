"use client"

import * as React from "react"
import MuiTable from "@mui/material/Table"
import MuiTableHead from "@mui/material/TableHead"
import MuiTableBody from "@mui/material/TableBody"
import MuiTableFooter from "@mui/material/TableFooter"
import MuiTableRow from "@mui/material/TableRow"
import MuiTableCell from "@mui/material/TableCell"

import { cn } from "@/lib/utils"

/** The container scrolls horizontally when the table is wider than the screen; the scrollbar itself is hidden (`no-scrollbar`, app/globals.css). */
function Table({ className, ...props }: React.ComponentProps<"table">) {
  return (
    <div
      data-slot="table-container"
      className="relative w-full overflow-x-auto no-scrollbar"
    >
      <MuiTable size="small"
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...(props as object)}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <MuiTableHead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...(props as object)}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <MuiTableBody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...(props as object)}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <MuiTableFooter
      data-slot="table-footer"
      className={cn(
        "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...(props as object)}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <MuiTableRow
      data-slot="table-row"
      className={cn(
        "group border-b transition-colors hover:bg-muted/50 has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted",
        className
      )}
      {...(props as object)}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <MuiTableCell component="th"
      data-slot="table-head"
      className={cn(
        "h-10 px-2 text-left align-middle font-medium whitespace-nowrap text-foreground [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as object)}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <MuiTableCell
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0",
        className
      )}
      {...(props as object)}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("mt-4 text-sm text-muted-foreground", className)}
      {...(props as object)}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
