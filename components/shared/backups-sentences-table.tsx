"use client"

import { useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, History, MoreHorizontal } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewBackupSentenceDialog } from "@/components/shared/view-backup-sentence-dialog"
import { BackupCodeHistoryDialog } from "@/components/shared/backup-code-history-dialog"
import type { Backup } from "@prisma/client"

const RESTORE_STATUS_LABELS: Record<string, { label: string; variant: "outline" | "default" | "destructive" }> = {
  NOT_RESTORED: { label: "Não restaurado", variant: "outline" },
  RESTORED: { label: "Restaurado", variant: "default" },
  ERROR: { label: "Erro ao restaurar", variant: "destructive" },
}

interface BackupsSentencesTableProps {
  filterId: string
  data: Backup[]
  onRestoreSingle: (backupId: string) => void
}

export function BackupsSentencesTable({ filterId, data, onRestoreSingle }: BackupsSentencesTableProps) {
  const [viewDialog, setViewDialog] = useState<{ open: boolean; backup: Backup | null }>({ open: false, backup: null })
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; codeSentence: string | null }>({
    open: false,
    codeSentence: null,
  })

  const columns: ColumnDef<Backup>[] = [
    { accessorKey: "codeSentence", header: "Código da consulta", cell: ({ row }) => row.getValue("codeSentence") || "-" },
    { accessorKey: "codColigada", header: "Coligada", cell: ({ row }) => row.getValue("codColigada") || "-" },
    { accessorKey: "codSystem", header: "Sistema TOTVS", cell: ({ row }) => row.getValue("codSystem") || "-" },
    { accessorKey: "nameSentence", header: "Nome da consulta", cell: ({ row }) => row.getValue("nameSentence") || "-" },
    {
      accessorKey: "createdAt",
      header: "Data da versão mais recente",
      cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleString("pt-BR"),
    },
    {
      accessorKey: "restoreStatus",
      header: "Status da restauração do backup",
      cell: ({ row }) => {
        const status = RESTORE_STATUS_LABELS[row.getValue("restoreStatus") as string]
        return <Badge variant={status?.variant ?? "outline"}>{status?.label ?? "-"}</Badge>
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
            <DropdownMenuItem onClick={() => setViewDialog({ open: true, backup: row.original })}>
              <Eye className="h-4 w-4 mr-2" /> Visualizar
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setHistoryDialog({ open: true, codeSentence: row.original.codeSentence })}
            >
              <History className="h-4 w-4 mr-2" /> Histórico de alterações
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  return (
    <>
      <DataTable columns={columns} data={data} searchPlaceholder="Buscar por código ou nome..." />

      <ViewBackupSentenceDialog
        open={viewDialog.open}
        onOpenChange={(open) => setViewDialog({ open, backup: open ? viewDialog.backup : null })}
        backup={viewDialog.backup}
        onRestore={(backupId) => {
          setViewDialog({ open: false, backup: null })
          onRestoreSingle(backupId)
        }}
      />
      <BackupCodeHistoryDialog
        open={historyDialog.open}
        onOpenChange={(open) => setHistoryDialog({ open, codeSentence: open ? historyDialog.codeSentence : null })}
        filterId={filterId}
        codeSentence={historyDialog.codeSentence}
        onRestoreSingle={onRestoreSingle}
      />
    </>
  )
}
