"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, RotateCcw, MoreHorizontal } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { BackupRunSentencesDialog } from "@/components/shared/backup-run-sentences-dialog"
import type { BackupRun } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface BackupsHistoryTableProps {
  filterId: string
  data: BackupRun[]
  meta: PaginationMeta
  onRestoreRun: (backupRunId: string) => void
  onRestoreSingle: (backupId: string) => void
}

export function BackupsHistoryTable({ data, meta, onRestoreRun, onRestoreSingle }: BackupsHistoryTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewDialog, setViewDialog] = useState<{ open: boolean; backupRunId: string | null; startedAt: Date | null }>({
    open: false,
    backupRunId: null,
    startedAt: null,
  })

  function pushRunsParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key)
      else params.set(key, String(value))
    })
    router.push(`?${params.toString()}`)
  }

  const columns: ColumnDef<BackupRun>[] = [
    {
      accessorKey: "startedAt",
      header: "Data do backup",
      cell: ({ row }) => new Date(row.getValue("startedAt")).toLocaleString("pt-BR"),
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
  ]

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushRunsParams({ runsPage: p })}
        onPageSizeChange={(ps) => pushRunsParams({ runsPageSize: ps, runsPage: 1 })}
        searchable={false}
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
