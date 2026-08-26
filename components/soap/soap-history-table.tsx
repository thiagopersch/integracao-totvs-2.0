"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import { cn } from "@/utils/cn"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { PageHeader } from "@/components/shared/page-header"
import { CodeEditor } from "@/components/shared/code-editor"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { MultiSelect } from "@/components/ui/multi-select"
import { Slider } from "@/components/ui/slider"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatDate, formatDuration } from "@/utils/format"
import { safeFormatXml, safeFormatXmlDeep } from "@/utils/xml"
import { reexecuteSoapLog } from "@/actions/soap"
import { Eye, RotateCcw, Maximize2, Minimize2 } from "lucide-react"
import { toast } from "sonner"
import type { ColumnDef } from "@tanstack/react-table"
import type { Client, SoapLog } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"
import type { TbcRow } from "@/services/tbc.service"
import type { SoapEndpointTypeWithMethods } from "@/services/soap-endpoint.service"

type SoapLogRow = SoapLog & { user?: { id: string; name: string } | null }

const HTTP_STATUS_LABELS: Record<number, string> = {
  0: "Erro",
  200: "OK",
  201: "Criado",
  204: "Sem conteúdo",
  400: "Requisição inválida",
  401: "Não autorizado",
  403: "Proibido",
  404: "Não encontrado",
  408: "Tempo esgotado",
  409: "Conflito",
  422: "Entidade não processável",
  429: "Muitas requisições",
  500: "Erro interno",
  502: "Gateway inválido",
  503: "Serviço indisponível",
  504: "Tempo do gateway esgotado",
}

function formatStatusOption(status: number): string {
  const label = HTTP_STATUS_LABELS[status]
  return label ? `${status} - ${label}` : String(status)
}

interface SoapHistoryTableProps {
  data: SoapLogRow[]
  meta: PaginationMeta
  clients: Client[]
  tbcs: TbcRow[]
  endpointTypes: SoapEndpointTypeWithMethods[]
  statuses: number[]
}

const SORTABLE_COLUMNS = ["dataserver", "process", "method", "status", "duration", "createdAt"]

export function SoapHistoryTable({ data, meta, clients, tbcs, endpointTypes, statuses }: SoapHistoryTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const sortParam = searchParams.get("sort")
  const sort = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : { field: "createdAt", direction: "desc" as const }
  const [executing, setExecuting] = useState<string | null>(null)
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; log: SoapLogRow | null }>({ open: false, log: null })
  const [fullscreen, setFullscreen] = useState(false)
  const [reexecuteDialog, setReexecuteDialog] = useState<{ open: boolean; log: SoapLogRow | null }>({ open: false, log: null })

  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")
  const [tbcFilter, setTbcFilter] = useState(searchParams.get("tbcId") || "")
  const [endpointTypeFilter, setEndpointTypeFilter] = useState(searchParams.get("endpointTypeId") || "")
  const [methodFilter, setMethodFilter] = useState(searchParams.get("method") || "")
  const [statusFilter, setStatusFilter] = useState<string[]>(
    searchParams.get("status")?.split(",").filter(Boolean) || []
  )
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom")
    const to = searchParams.get("dateTo")
    return from ? { from: new Date(from), to: to ? new Date(to) : undefined } : undefined
  })
  const [minDuration, setMinDuration] = useState(Number(searchParams.get("minDuration")) || 0)

  const filteredTbcs = clientFilter ? tbcs.filter((t) => t.client?.id === clientFilter) : []
  const selectedEndpointType = endpointTypes.find((t) => t.id === endpointTypeFilter)
  const availableMethods = selectedEndpointType?.methods ?? []

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([k, v]) => {
      if (v === undefined || v === "") params.delete(k)
      else params.set(k, String(v))
    })
    router.push(`?${params.toString()}`)
  }

  function clearFilters() {
    setClientFilter("")
    setTbcFilter("")
    setEndpointTypeFilter("")
    setMethodFilter("")
    setStatusFilter([])
    setDateRange(undefined)
    setMinDuration(0)
    pushParams({
      clientId: undefined,
      tbcId: undefined,
      endpointTypeId: undefined,
      method: undefined,
      status: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      minDuration: undefined,
      page: 1,
    })
  }

  function applyFilters() {
    pushParams({
      clientId: clientFilter || undefined,
      tbcId: tbcFilter || undefined,
      endpointTypeId: endpointTypeFilter || undefined,
      method: methodFilter || undefined,
      status: statusFilter.length ? statusFilter.join(",") : undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      minDuration: minDuration || undefined,
      page: 1,
    })
  }

  function requestReexecute(log: SoapLogRow) {
    setReexecuteDialog({ open: true, log })
  }

  async function confirmReexecute() {
    const log = reexecuteDialog.log
    if (!log) return
    setExecuting(log.id)
    try {
      const result = await reexecuteSoapLog(log.id)
      if (result.success) {
        toast.success("Reexecução concluída")
        router.refresh()
      } else {
        toast.error(result.error || "Erro na reexecução")
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro na reexecução")
    } finally {
      setExecuting(null)
      setReexecuteDialog({ open: false, log: null })
    }
  }

  const filterPanel = (
    <DataTableFilterPanel onApply={applyFilters} onClear={clearFilters}>
      <div className="space-y-2">
        <Label>Cliente</Label>
        <Combobox
          items={clients.map((c) => ({ value: c.id, label: c.name }))}
          value={clientFilter}
          onValueChange={(v) => {
            setClientFilter(v)
            setTbcFilter("")
          }}
          placeholder="Todos"
        />
      </div>
      <div className="space-y-2">
        <Label>TBC</Label>
        <Combobox
          items={filteredTbcs.map((t) => ({ value: t.id, label: t.name }))}
          value={tbcFilter}
          onValueChange={setTbcFilter}
          placeholder={clientFilter ? "Todos" : "Selecione um cliente primeiro"}
          disabled={!clientFilter}
        />
      </div>
      <div className="space-y-2">
        <Label>Serviço</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...endpointTypes.map((t) => ({ value: t.id, label: t.label }))]}
          value={endpointTypeFilter || "all"}
          onValueChange={(v) => {
            setEndpointTypeFilter(!v || v === "all" ? "" : v)
            setMethodFilter("")
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {endpointTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Método</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...availableMethods.map((m) => ({ value: m.method, label: m.label }))]}
          value={methodFilter || "all"}
          onValueChange={(v) => setMethodFilter(!v || v === "all" ? "" : v)}
          disabled={!endpointTypeFilter}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {availableMethods.map((m) => (
              <SelectItem key={m.id} value={m.method}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <MultiSelect
          items={statuses.map((s) => ({ value: String(s), label: formatStatusOption(s) }))}
          value={statusFilter}
          onValueChange={setStatusFilter}
          placeholder="Todos"
        />
      </div>
      <div className="space-y-2">
        <Label>Data</Label>
        <DateRangePicker value={dateRange} onValueChange={setDateRange} placeholder="Selecione um período" />
      </div>
      <div className="space-y-2">
        <Label>Duração mínima: {minDuration}s</Label>
        <Slider
          min={0}
          max={60}
          step={1}
          value={minDuration}
          onValueChange={(v) => setMinDuration(v)}
          className="pt-2"
        />
      </div>
    </DataTableFilterPanel>
  )

  const columns: ColumnDef<SoapLogRow>[] = [
    {
      accessorKey: "dataserver",
      header: "Endpoint (TBC)",
      cell: ({ row }) => <span className="font-mono text-xs">{row.getValue("dataserver") || "-"}</span>,
    },
    {
      accessorKey: "process",
      header: "Serviço",
      cell: ({ row }) => row.getValue("process") || "-",
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
        return error ? <span className="text-destructive text-sm truncate max-w-[200px] block">{error}</span> : "-"
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
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDetailDialog({ open: true, log: row.original })}
            title="Ver detalhes"
          >
            <Eye className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            disabled={executing === row.original.id}
            onClick={() => requestReexecute(row.original)}
            title="Reexecutar"
          >
            <RotateCcw className={`h-4 w-4 ${executing === row.original.id ? "animate-spin" : ""}`} />
          </Button>
        </div>
      ),
    },
  ]

  const detail = detailDialog.log

  return (
    <>
      <PageHeader title="Histórico SOAP" description="Chamadas SOAP realizadas — clique em um registro para ver todos os detalhes" />
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
        onRowClick={(log) => setDetailDialog({ open: true, log })}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={(s) => pushParams({ sort: `${s.field}:${s.direction}`, page: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
      />

      <ConfirmDialog
        open={reexecuteDialog.open}
        onOpenChange={(open) => !executing && setReexecuteDialog({ open, log: open ? reexecuteDialog.log : null })}
        title="Reexecutar chamada SOAP"
        description={`Isso vai reexecutar ${reexecuteDialog.log?.method ?? "esta chamada"} contra "${reexecuteDialog.log?.dataserver ?? "o TBC original"}", chamando primeiro AutenticaAcesso e CheckServiceActivity (conforme exigido pelo TOTVS) antes do método de destino.`}
        confirmLabel="Reexecutar"
        onConfirm={confirmReexecute}
        loading={executing === reexecuteDialog.log?.id}
        loadingLabel="Reexecutando..."
      />

      <Dialog
        open={detailDialog.open}
        onOpenChange={(open) => {
          setDetailDialog({ open, log: open ? detailDialog.log : null })
          if (!open) setFullscreen(false)
        }}
      >
        <DialogContent
          className={cn(
            "transition-[width,height]",
            fullscreen
              ? "h-[100vh]! max-h-[100vh]! w-[100vw]! max-w-[100vw]! rounded-none!"
              : "h-[70vh]! max-h-[70vh]! w-[70vw]! max-w-[70vw]!"
          )}
        >
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              Detalhes da chamada SOAP
              {detail && <Badge variant="outline">{detail.method}</Badge>}
              {detail && (
                <Badge variant={detail.status && detail.status < 400 ? "default" : "destructive"}>
                  {detail.status || "Erro"}
                </Badge>
              )}
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="ml-auto"
                onClick={() => setFullscreen((v) => !v)}
                title={fullscreen ? "Restaurar tamanho" : "Maximizar"}
              >
                {fullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </DialogTitle>
          </DialogHeader>
          {detail && (
            <DialogBody>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Endpoint (TBC)</p>
                  <p className="font-mono text-xs break-all">{detail.dataserver || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Serviço</p>
                  <p>{detail.process || "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Duração</p>
                  <p>{detail.duration ? formatDuration(detail.duration) : "-"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Usuário</p>
                  <p>{detail.user?.name || "Sistema"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p>{formatDate(detail.createdAt)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ID do registro</p>
                  <p className="font-mono text-xs break-all">{detail.id}</p>
                </div>
              </div>

              {detail.error && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Erro</p>
                  <pre className="whitespace-pre-wrap rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                    {detail.error}
                  </pre>
                </div>
              )}

              {detail.context !== null && detail.context !== undefined && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contexto</p>
                  <CodeEditor
                    value={JSON.stringify(detail.context, null, 2)}
                    language="json"
                    readOnly
                    theme="dark"
                    resetKey={detail.id}
                    minHeight={fullscreen ? "30vh" : "160px"}
                  />
                </div>
              )}

              <Tabs defaultValue="request">
                <TabsList>
                  <TabsTrigger value="request">XML Requisição</TabsTrigger>
                  <TabsTrigger value="response-xml">XML Resposta</TabsTrigger>
                  <TabsTrigger value="response-json">JSON Resposta</TabsTrigger>
                </TabsList>
                <TabsContent value="request">
                  {detail.xmlRequest ? (
                    <CodeEditor
                      value={safeFormatXml(detail.xmlRequest)}
                      language="xml"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-request`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem XML de requisição registrado.</p>
                  )}
                </TabsContent>
                <TabsContent value="response-xml">
                  {detail.xmlResponse ? (
                    <CodeEditor
                      value={safeFormatXmlDeep(detail.xmlResponse)}
                      language="xml"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-response-xml`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem XML de resposta registrado.</p>
                  )}
                </TabsContent>
                <TabsContent value="response-json">
                  {detail.jsonResponse ? (
                    <CodeEditor
                      value={JSON.stringify(detail.jsonResponse, null, 2)}
                      language="json"
                      readOnly
                      theme="dark"
                      resetKey={`${detail.id}-response-json`}
                      minHeight={fullscreen ? "45vh" : "260px"}
                    />
                  ) : (
                    <p className="p-3 text-xs text-muted-foreground">Sem JSON de resposta registrado.</p>
                  )}
                </TabsContent>
              </Tabs>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
