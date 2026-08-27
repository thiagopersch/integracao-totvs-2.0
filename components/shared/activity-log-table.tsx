"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatDate, formatDuration } from "@/utils/format"
import { safeFormatXmlDeep } from "@/utils/xml"
import { FileText, Radio, Mail, Plug } from "lucide-react"
import type { ActivityRow, ActivitySource, ActivityStatus } from "@/services/activity-log.service"
import type { AuditLog, SoapLog, EmailLog, ApiLog } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"

interface ActivityLogTableProps {
  data: ActivityRow[]
  meta: PaginationMeta
}

const SOURCE_LABELS: Record<ActivitySource, string> = { CRUD: "CRUD", SOAP: "SOAP", EMAIL: "E-mail", API: "API" }
const SOURCE_ICONS: Record<ActivitySource, typeof FileText> = { CRUD: FileText, SOAP: Radio, EMAIL: Mail, API: Plug }

function statusVariant(status: ActivityStatus): "default" | "destructive" | "secondary" {
  if (status === "ERROR") return "destructive"
  if (status === "SKIPPED") return "secondary"
  return "default"
}

function statusLabel(status: ActivityStatus): string {
  if (status === "ERROR") return "Erro"
  if (status === "SKIPPED") return "Ignorado"
  return "OK"
}

export function ActivityLogTable({ data, meta }: ActivityLogTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<ActivityRow | null>(null)

  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom")
    const to = searchParams.get("dateTo")
    return from ? { from: new Date(from), to: to ? new Date(to) : undefined } : undefined
  })

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    setSourceFilter("")
    setDateRange(undefined)
    pushParams({ source: undefined, dateFrom: undefined, dateTo: undefined, page: 1 })
  }

  function applyFilters() {
    pushParams({
      source: sourceFilter || undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      page: 1,
    })
  }

  const filterPanel = (
    <DataTableFilterPanel onApply={applyFilters} onClear={clearFilters}>
      <div className="space-y-2">
        <Label>Fonte</Label>
        <Select
          items={[{ value: "all", label: "Todas" }, ...Object.entries(SOURCE_LABELS).map(([value, label]) => ({ value, label }))]}
          value={sourceFilter || "all"}
          onValueChange={(v) => setSourceFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(SOURCE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Período</Label>
        <DateRangePicker value={dateRange} onValueChange={setDateRange} placeholder="Selecione um período" />
      </div>
    </DataTableFilterPanel>
  )

  const columns: ColumnDef<ActivityRow>[] = [
    {
      id: "source",
      header: "Fonte",
      cell: ({ row }) => {
        const Icon = SOURCE_ICONS[row.original.source]
        return (
          <Badge variant="outline" className="gap-1">
            <Icon className="h-3 w-3" />
            {SOURCE_LABELS[row.original.source]}
          </Badge>
        )
      },
    },
    { accessorKey: "summary", header: "Resumo", cell: ({ row }) => <span className="line-clamp-1">{row.original.summary}</span> },
    { accessorKey: "actorName", header: "Usuário", cell: ({ row }) => row.original.actorName || "Sistema" },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={statusVariant(row.original.status)}>{statusLabel(row.original.status)}</Badge>,
    },
    {
      accessorKey: "durationMs",
      header: "Duração",
      cell: ({ row }) => (row.original.durationMs ? formatDuration(row.original.durationMs) : "-"),
    },
    {
      accessorKey: "createdAt",
      header: "Data",
      cell: ({ row }) => formatDate(row.original.createdAt),
    },
  ]

  return (
    <>
      <PageHeader title="Rastreamento de Atividades" description="CRUD, chamadas SOAP, e-mails e integrações externas — clique em um registro para ver todos os detalhes" />
      <DataTable
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        onRowClick={(row) => setDetail(row)}
        filterPanel={filterPanel}
      />

      <ActivityDetailDialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)} row={detail} />
    </>
  )
}

function ActivityDetailDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: ActivityRow | null }) {
  if (!row) return null

  const Icon = SOURCE_ICONS[row.source]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[70vh]! max-h-[70vh]! w-[70vw]! max-w-[70vw]!">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {row.summary}
            <Badge variant="outline">{SOURCE_LABELS[row.source]}</Badge>
            <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Usuário</p>
              <p>{row.actorName || "Sistema"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Duração</p>
              <p>{row.durationMs ? formatDuration(row.durationMs) : "-"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Data</p>
              <p>{formatDate(row.createdAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">ID do registro</p>
              <p className="font-mono text-xs break-all">{row.id}</p>
            </div>
          </div>

          {row.source === "CRUD" && <CrudDetail raw={row.raw as AuditLog} />}
          {row.source === "SOAP" && <SoapDetail raw={row.raw as SoapLog} />}
          {row.source === "EMAIL" && <EmailDetail raw={row.raw as EmailLog} />}
          {row.source === "API" && <ApiDetail raw={row.raw as ApiLog} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function DataBlock({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <pre className="max-h-48 overflow-auto rounded-md border bg-muted/30 p-2 text-xs whitespace-pre-wrap break-all">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  )
}

function CrudDetail({ raw }: { raw: AuditLog }) {
  return (
    <div className="space-y-3">
      <DataBlock label="Dados anteriores" value={raw.oldData} />
      <DataBlock label="Dados novos" value={raw.newData} />
    </div>
  )
}

function SoapDetail({ raw }: { raw: SoapLog }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Endpoint (TBC)</p>
          <p className="font-mono text-xs break-all">{raw.dataserver || "-"}</p>
        </div>
        {raw.error && (
          <div>
            <p className="text-xs text-muted-foreground">Erro</p>
            <p className="text-xs text-destructive">{raw.error}</p>
          </div>
        )}
      </div>
      <DataBlock label="Requisição (XML)" value={raw.xmlRequest ? safeFormatXmlDeep(raw.xmlRequest) : null} />
      <DataBlock label="Resposta (XML)" value={raw.xmlResponse ? safeFormatXmlDeep(raw.xmlResponse) : null} />
    </div>
  )
}

function EmailDetail({ raw }: { raw: EmailLog }) {
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Destinatário</p>
        <p>{raw.to}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Assunto</p>
        <p>{raw.subject}</p>
      </div>
      {raw.error && (
        <div className="col-span-2">
          <p className="text-xs text-muted-foreground">Erro</p>
          <p className="text-xs text-destructive">{raw.error}</p>
        </div>
      )}
    </div>
  )
}

function ApiDetail({ raw }: { raw: ApiLog }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">URL</p>
          <p className="font-mono text-xs break-all">{raw.url}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status HTTP</p>
          <p>{raw.httpStatus ?? "-"}</p>
        </div>
        {raw.error && (
          <div className="col-span-2">
            <p className="text-xs text-muted-foreground">Erro</p>
            <p className="text-xs text-destructive">{raw.error}</p>
          </div>
        )}
      </div>
      <DataBlock label="Requisição" value={raw.requestSummary} />
      <DataBlock label="Resposta" value={raw.responseSummary} />
    </div>
  )
}
