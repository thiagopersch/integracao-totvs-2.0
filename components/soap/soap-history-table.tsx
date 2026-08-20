"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DataTable } from "@/components/shared/data-table"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate, formatDuration } from "@/utils/format"
import { RotateCcw } from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import type { SoapLog } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface SoapHistoryTableProps {
  data: (SoapLog & { user?: { id: string; name: string } | null })[]
  meta: PaginationMeta
}

export function SoapHistoryTable({ data, meta }: SoapHistoryTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [executing, setExecuting] = useState<string | null>(null)

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  async function handleReexecute(log: SoapLog) {
    setExecuting(log.id)
    try {
      const res = await fetch("/api/soap/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dataserver: log.dataserver,
          process: log.process,
          method: log.method,
          xml: log.xmlRequest,
        }),
      })

      if (res.ok) {
        toast.success("Reexecução concluída")
      } else {
        const err = await res.json()
        toast.error(err.error || "Erro na reexecução")
      }
    } catch (err: any) {
      toast.error(err.message)
    }
    setExecuting(null)
  }

  const columns: ColumnDef<SoapLog>[] = [
    {
      accessorKey: "dataserver",
      header: "Dataserver",
    },
    {
      accessorKey: "process",
      header: "Processo",
    },
    {
      accessorKey: "method",
      header: "Método",
      cell: ({ row }) => <Badge variant="outline">{row.getValue("method") as string}</Badge>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as number
        return (
          <Badge variant={status && status < 400 ? "default" : "destructive"}>
            {status || "Erro"}
          </Badge>
        )
      },
    },
    {
      accessorKey: "duration",
      header: "Duração",
      cell: ({ row }) => {
        const duration = row.getValue("duration") as number
        return duration ? formatDuration(duration) : "-"
      },
    },
    {
      accessorKey: "error",
      header: "Erro",
      cell: ({ row }) => {
        const error = row.getValue("error") as string
        return error ? <span className="text-destructive text-sm truncate max-w-[200px]">{error}</span> : "-"
      },
    },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => formatDate(row.getValue("createdAt") as Date),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          disabled={executing === row.original.id}
          onClick={() => handleReexecute(row.original)}
        >
          <RotateCcw className={`h-4 w-4 ${executing === row.original.id ? "animate-spin" : ""}`} />
        </Button>
      ),
    },
  ]

  return (
    <>
      <PageHeader title="Histórico SOAP" description="Chamadas SOAP realizadas" />
      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar por dataserver ou processo..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
      />
    </>
  )
}
