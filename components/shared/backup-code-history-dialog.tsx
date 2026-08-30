"use client"

import { useEffect, useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { listBackupHistoryForCode } from "@/actions/admin/backups"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ViewBackupSentenceDialog } from "@/components/shared/view-backup-sentence-dialog"
import type { Backup } from "@/generated/prisma/client"

const SORTABLE_COLUMNS = ["codeSentence", "codColigada", "codSystem", "nameSentence", "createdAt"]

interface BackupCodeHistoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filterId: string
  codeSentence: string | null
  onRestoreSingle: (backupId: string) => void
}

export function BackupCodeHistoryDialog({
  open,
  onOpenChange,
  filterId,
  codeSentence,
  onRestoreSingle,
}: BackupCodeHistoryDialogProps) {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Backup[]>([])
  const [sort, setSort] = useState<{ field: string; direction: "asc" | "desc" }>({ field: "createdAt", direction: "desc" })
  const [viewDialog, setViewDialog] = useState<{ open: boolean; backup: Backup | null }>({ open: false, backup: null })

  useEffect(() => {
    if (!open || !codeSentence) return
    async function load() {
      setLoading(true)
      const result = await listBackupHistoryForCode(filterId, codeSentence!)
      setData(result)
      setLoading(false)
    }
    load()
  }, [open, filterId, codeSentence])

  // This dialog's data is a small, already-loaded list (no backend pagination requested here), so
  // sorting is done client-side — reusing the same clickable-header UI/logic from DataTable that
  // drives server-side sort elsewhere, just fed by local state instead of URL params.
  const sortedData = useMemo(() => {
    const field = sort.field as keyof Backup
    const dir = sort.direction === "asc" ? 1 : -1
    return [...data].sort((a, b) => {
      const av = a[field]
      const bv = b[field]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return -dir
      if (av > bv) return dir
      return 0
    })
  }, [data, sort])

  const columns: ColumnDef<Backup>[] = [
    { accessorKey: "codeSentence", header: "Código da consulta", cell: ({ row }) => row.getValue("codeSentence") || "-" },
    { accessorKey: "codColigada", header: "Coligada", cell: ({ row }) => row.getValue("codColigada") || "-" },
    { accessorKey: "codSystem", header: "Sistema TOTVS", cell: ({ row }) => row.getValue("codSystem") || "-" },
    { accessorKey: "nameSentence", header: "Nome da consulta", cell: ({ row }) => row.getValue("nameSentence") || "-" },
    {
      accessorKey: "createdAt",
      header: "Data da versão",
      cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button variant="ghost" size="sm" onClick={() => setViewDialog({ open: true, backup: row.original })}>
          <Eye className="h-4 w-4 mr-2" /> Visualizar
        </Button>
      ),
    },
  ]

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Histórico de alterações — {codeSentence}</DialogTitle>
          </DialogHeader>
          <DialogBody>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <DataTable
                columns={columns}
                data={sortedData}
                searchable={false}
                sort={sort}
                onSortChange={setSort}
                sortableColumns={SORTABLE_COLUMNS}
              />
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>

      <ViewBackupSentenceDialog
        open={viewDialog.open}
        onOpenChange={(v) => setViewDialog({ open: v, backup: v ? viewDialog.backup : null })}
        backup={viewDialog.backup}
        onRestore={(backupId) => {
          setViewDialog({ open: false, backup: null })
          onOpenChange(false)
          onRestoreSingle(backupId)
        }}
      />
    </>
  )
}
