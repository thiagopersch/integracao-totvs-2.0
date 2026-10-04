"use client"

import { useUrlParams } from "@/hooks/use-url-params"
import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, RotateCcw, MoreHorizontal } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import { DateCell } from "@/components/shared/date-cell"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BackupRunSentencesDialog } from "@/components/shared/backup-run-sentences-dialog"
import type { BackupRun } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

interface BackupsHistoryTableProps {
  filterId: string
  data: BackupRun[]
  meta: PaginationMeta
  onRestoreRun: (backupRunId: string) => void
  onRestoreSingle: (backupId: string) => void
}

const SORTABLE_COLUMNS = ["startedAt"]

export function BackupsHistoryTable({ data, meta, onRestoreRun, onRestoreSingle }: BackupsHistoryTableProps) {
  const { searchParams, isPending, pushParams: pushRunsParams } = useUrlParams()
  const [viewDialog, setViewDialog] = useState<{ open: boolean; backupRunId: string | null; startedAt: Date | null }>({
    open: false,
    backupRunId: null,
    startedAt: null,
  })

  const runsSortParam = searchParams.get("runsSort")
  const runsSort = runsSortParam
    ? { field: runsSortParam.split(":")[0], direction: runsSortParam.split(":")[1] as "asc" | "desc" }
    : { field: "startedAt", direction: "desc" as const }

  const columns: ColumnDef<BackupRun>[] = useMemo(() => [
    {
      accessorKey: "startedAt",
      header: "Data do backup",
      cell: ({ row }) => {
        const startedAt = row.getValue("startedAt") as string
        return <DateCell date={startedAt}>{new Date(startedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</DateCell>
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center justify-center h-8 w-8 p-0 rounded-md hover:bg-accent cursor-pointer">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-auto whitespace-nowrap">
            <DropdownMenuItem
              onClick={() => setViewDialog({ open: true, backupRunId: row.original.id, startedAt: row.original.startedAt })}
            >
              <Eye className="h-4 w-4 mr-2" /> Visualizar sentenças
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRestoreRun(row.original.id)}>
              <RotateCcw className="h-4 w-4 mr-2" /> Restaurar backup
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ], [onRestoreRun])

  return (
    <>
      <DataTable
        refreshing={isPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushRunsParams({ runsPage: p })}
        onPageSizeChange={(ps) => pushRunsParams({ runsPageSize: ps, runsPage: 1 })}
        searchable={false}
        sort={runsSort}
        onSortChange={(s) => pushRunsParams({ runsSort: `${s.field}:${s.direction}`, runsPage: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
      />

      <BackupRunSentencesDialog
        open={viewDialog.open}
        onOpenChange={(open) => setViewDialog({ open, backupRunId: open ? viewDialog.backupRunId : null, startedAt: open ? viewDialog.startedAt : null })}
        backupRunId={viewDialog.backupRunId}
        startedAt={viewDialog.startedAt}
        onRestoreSingle={onRestoreSingle}
      />
    </>
  )
}
