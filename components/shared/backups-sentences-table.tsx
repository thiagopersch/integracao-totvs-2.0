"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, History, MoreHorizontal } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ViewBackupSentenceDialog } from "@/components/shared/view-backup-sentence-dialog"
import { BackupCodeHistoryDialog } from "@/components/shared/backup-code-history-dialog"
import { getLatestBackupForCode } from "@/actions/admin/backups"
import { toast } from "sonner"
import type { Backup } from "@/generated/prisma/client"
import type { PaginationMeta } from "@/types/common"

const SORTABLE_COLUMNS = ["codeSentence", "codColigada", "codSystem", "nameSentence", "createdAt", "restoreStatus"]

const RESTORE_STATUS_LABELS: Record<string, { label: string; variant: "outline" | "default" | "destructive" }> = {
  NOT_RESTORED: { label: "Não restaurado", variant: "outline" },
  RESTORED: { label: "Restaurado", variant: "default" },
  ERROR: { label: "Erro ao restaurar", variant: "destructive" },
}

interface BackupsSentencesTableProps {
  filterId: string
  data: Backup[]
  meta: PaginationMeta
  onRestoreSingle: (backupId: string) => void
}

export function BackupsSentencesTable({ filterId, data, meta, onRestoreSingle }: BackupsSentencesTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [viewDialog, setViewDialog] = useState<{ open: boolean; backup: Backup | null }>({ open: false, backup: null })
  const [viewingCode, setViewingCode] = useState<string | null>(null)
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; codeSentence: string | null }>({
    open: false,
    codeSentence: null,
  })
  const [coligadaFilter, setColigadaFilter] = useState(searchParams.get("codColigada") || "")
  const [sistemaFilter, setSistemaFilter] = useState(searchParams.get("codSystem") || "")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom")
    const to = searchParams.get("dateTo")
    return from ? { from: new Date(from), to: to ? new Date(to) : undefined } : undefined
  })

  const sortParam = searchParams.get("sort")
  const sort = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : { field: "codeSentence", direction: "asc" as const }

  function pushSentenceParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key)
      else params.set(key, String(value))
    })
    router.push(`?${params.toString()}`)
  }

  async function handleView(row: Backup) {
    if (!row.codeSentence) {
      setViewDialog({ open: true, backup: row })
      return
    }
    setViewingCode(row.codeSentence)
    try {
      const latest = await getLatestBackupForCode(filterId, row.codeSentence)
      setViewDialog({ open: true, backup: latest ?? row })
    } catch {
      toast.error("Erro ao buscar a versão mais recente da sentença")
    } finally {
      setViewingCode(null)
    }
  }

  const columns: ColumnDef<Backup>[] = [
    { accessorKey: "codeSentence", header: "Código da consulta", cell: ({ row }) => row.getValue("codeSentence") || "-" },
    { accessorKey: "codColigada", header: "Coligada", cell: ({ row }) => row.getValue("codColigada") || "-" },
    { accessorKey: "codSystem", header: "Sistema TOTVS", cell: ({ row }) => row.getValue("codSystem") || "-" },
    { accessorKey: "nameSentence", header: "Nome da consulta", cell: ({ row }) => row.getValue("nameSentence") || "-" },
    {
      accessorKey: "createdAt",
      header: "Data da versão mais recente",
      cell: ({ row }) => new Date(row.getValue("createdAt")).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
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
            <DropdownMenuItem disabled={viewingCode === row.original.codeSentence} onClick={() => handleView(row.original)}>
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

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushSentenceParams({
          codColigada: coligadaFilter || undefined,
          codSystem: sistemaFilter || undefined,
          dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
          dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
          page: 1,
        })
      }
      onClear={() => {
        setColigadaFilter("")
        setSistemaFilter("")
        setDateRange(undefined)
        pushSentenceParams({ codColigada: undefined, codSystem: undefined, dateFrom: undefined, dateTo: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Coligada</Label>
        <Input value={coligadaFilter} onChange={(e) => setColigadaFilter(e.target.value)} placeholder="Ex: 00001" />
      </div>
      <div className="space-y-2">
        <Label>Sistema</Label>
        <Input value={sistemaFilter} onChange={(e) => setSistemaFilter(e.target.value)} placeholder="Ex: S" />
      </div>
      <div className="space-y-2">
        <Label>Data</Label>
        <DateRangePicker value={dateRange} onValueChange={setDateRange} placeholder="Selecione um período" />
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushSentenceParams({ page: p })}
        onPageSizeChange={(ps) => pushSentenceParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por código, coligada, sistema ou nome..."
        searchDefaultValue={searchParams.get("search") || ""}
        onSearch={(v) => pushSentenceParams({ search: v || undefined, page: 1 })}
        sort={sort}
        onSortChange={(s) => pushSentenceParams({ sort: `${s.field}:${s.direction}`, page: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
        filterPanel={filterPanel}
      />

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
