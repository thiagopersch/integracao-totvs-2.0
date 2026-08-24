"use client"

import { useEffect, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye } from "lucide-react"
import { listBackupHistoryForCode } from "@/actions/admin/backups"
import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ViewBackupSentenceDialog } from "@/components/shared/view-backup-sentence-dialog"
import type { Backup } from "@prisma/client"

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

  const columns: ColumnDef<Backup>[] = [
    { accessorKey: "codeSentence", header: "Código da consulta", cell: ({ row }) => row.getValue("codeSentence") || "-" },
    { accessorKey: "codColigada", header: "Coligada", cell: ({ row }) => row.getValue("codColigada") || "-" },
    { accessorKey: "codSystem", header: "Sistema TOTVS", cell: ({ row }) => row.getValue("codSystem") || "-" },
    { accessorKey: "nameSentence", header: "Nome da consulta", cell: ({ row }) => row.getValue("nameSentence") || "-" },
    {
      accessorKey: "createdAt",
      header: "Data da versão",
      cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleString("pt-BR"),
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
            {loading ? <Skeleton className="h-64 w-full" /> : <DataTable columns={columns} data={data} searchable={false} />}
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
