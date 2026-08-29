"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"
import type { ColumnDef } from "@tanstack/react-table"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Combobox } from "@/components/ui/combobox"
import { MultiSelect } from "@/components/ui/multi-select"
import { Slider } from "@/components/ui/slider"
import { DateRangePicker } from "@/components/ui/date-range-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CodeEditor, type CodeEditorLanguage } from "@/components/shared/code-editor"
import { Button } from "@/components/ui/button"
import { formatDate, formatDuration } from "@/utils/format"
import { safeFormatXmlDeep } from "@/utils/xml"
import { ENTITY_LABELS, formatBlockingReferences, type BlockingReference } from "@/lib/entity-relations"
import { reexecuteSoapLog } from "@/actions/soap"
import { cn } from "@/utils/cn"
import { FileText, Radio, Mail, Plug, Trash2, Maximize2, Minimize2, Eye, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { STATUS_SYMBOLS } from "@/lib/activity-status"
import type { ActivityRow, ActivitySource, ActivityStatus } from "@/services/activity-log.service"
import type { AuditLog, SoapLog, EmailLog, ApiLog, Client, Dataserver, Process } from "@prisma/client"
import type { PaginationMeta } from "@/types/common"
import type { TbcRow } from "@/services/tbc.service"
import type { SoapEndpointTypeWithMethods } from "@/services/soap-endpoint.service"

interface TipoOption {
  value: string
  label: string
}

interface ActivityLogTableProps {
  data: ActivityRow[]
  meta: PaginationMeta
  clients: Client[]
  tbcs: TbcRow[]
  endpointTypes: SoapEndpointTypeWithMethods[]
  tipoOptions: { crud: TipoOption[]; deletion: TipoOption[]; api: TipoOption[] }
  methodOptions: TipoOption[]
  /** From the same `Dataserver`/`Process` catalogs the SOAP Builder page (`/soap/builder`) lets the
   *  user pick from — not distinct values scraped out of SoapLog. */
  dataservers: Dataserver[]
  processes: Process[]
  statusCodes: number[]
  canReexecuteSoap: boolean
}

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

const STATUS_SYMBOL_OPTIONS: { value: string; label: string; variant: "default" | "destructive" | "secondary" }[] = [
  { value: STATUS_SYMBOLS.CRUD_OK, label: "CRUD — OK", variant: "default" },
  { value: STATUS_SYMBOLS.EMAIL_SENT, label: "E-mail — Enviado", variant: "default" },
  { value: STATUS_SYMBOLS.EMAIL_FAILED, label: "E-mail — Falhou", variant: "destructive" },
  { value: STATUS_SYMBOLS.EMAIL_SKIPPED, label: "E-mail — Ignorado", variant: "secondary" },
  { value: STATUS_SYMBOLS.DELETION_BLOCKED, label: "Exclusão — Bloqueada", variant: "secondary" },
]

const SOURCE_LABELS: Record<ActivitySource, string> = {
  CRUD: "CRUD",
  SOAP: "SOAP",
  EMAIL: "E-mail",
  API: "API",
  DELETION: "Exclusão Bloqueada",
}
const SOURCE_ICONS: Record<ActivitySource, typeof FileText> = {
  CRUD: FileText,
  SOAP: Radio,
  EMAIL: Mail,
  API: Plug,
  DELETION: Trash2,
}

const SORTABLE_COLUMNS = ["createdAt"]

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

export function ActivityLogTable({
  data,
  meta,
  clients,
  tbcs,
  endpointTypes,
  tipoOptions,
  methodOptions,
  dataservers,
  processes,
  statusCodes,
  canReexecuteSoap,
}: ActivityLogTableProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [detail, setDetail] = useState<ActivityRow | null>(null)
  const [executing, setExecuting] = useState<string | null>(null)
  const [reexecuteRow, setReexecuteRow] = useState<ActivityRow | null>(null)

  const sortParam = searchParams.get("sort")
  const sort = sortParam
    ? { field: "createdAt", direction: sortParam.split(":")[1] as "asc" | "desc" }
    : { field: "createdAt", direction: "desc" as const }

  const [sourceFilter, setSourceFilter] = useState(searchParams.get("source") || "")
  const [clientFilter, setClientFilter] = useState(searchParams.get("clientId") || "")
  const [tbcFilter, setTbcFilter] = useState(searchParams.get("tbcId") || "")
  const [tipoFilter, setTipoFilter] = useState(searchParams.get("tipo") || "")
  const [methodFilter, setMethodFilter] = useState(searchParams.get("method") || "")
  const [dataserverProcessFilter, setDataserverProcessFilter] = useState(searchParams.get("dataserverProcess") || "")
  const [statusFilter, setStatusFilter] = useState<string[]>(searchParams.get("status")?.split(",").filter(Boolean) || [])
  const [minDuration, setMinDuration] = useState(Number(searchParams.get("minDuration")) || 0)
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const from = searchParams.get("dateFrom")
    const to = searchParams.get("dateTo")
    return from ? { from: new Date(from), to: to ? new Date(to) : undefined } : undefined
  })

  const filteredTbcs = clientFilter ? tbcs.filter((t) => t.client?.id === clientFilter) : []
  const tipoItems = [...tipoOptions.crud, ...tipoOptions.deletion, ...tipoOptions.api, ...endpointTypes.map((t) => ({ value: `soap:${t.id}`, label: `SOAP — ${t.label}` }))]

  const selectedEndpointType = tipoFilter.startsWith("soap:")
    ? endpointTypes.find((t) => `soap:${t.id}` === tipoFilter)
    : undefined
  const methodItems = selectedEndpointType
    ? selectedEndpointType.methods.map((m) => ({ value: m.method, label: m.label }))
    : methodOptions

  // Mirrors /soap/builder: only endpoint types of kind "dataserver"/"process" have a catalog to pick
  // from (Consulta SQL/Fórmula Visual/Relatórios have none), so narrow — or hide — accordingly.
  const dataserverItems = dataservers.map((d) => ({ value: `dataserver:${d.id}`, label: `${d.name} (${d.code})` }))
  const processItems = processes.map((p) => ({ value: `process:${p.id}`, label: `${p.name} (${p.code})` }))
  const dataserverProcessItems = !tipoFilter
    ? [...dataserverItems, ...processItems]
    : selectedEndpointType?.type === "dataserver"
      ? dataserverItems
      : selectedEndpointType?.type === "process"
        ? processItems
        : []
  const dataserverProcessDisabled = !!tipoFilter && dataserverProcessItems.length === 0
  const dataserverProcessPlaceholder = dataserverProcessDisabled ? "Não se aplica a este tipo" : "Todos"

  const statusItems = [
    ...statusCodes.map((s) => ({
      value: String(s),
      label: formatStatusOption(s),
      render: (
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs">{s}</span>
          <Badge variant={s < 400 ? "default" : "destructive"}>{HTTP_STATUS_LABELS[s] || String(s)}</Badge>
        </span>
      ),
    })),
    ...STATUS_SYMBOL_OPTIONS.map((s) => ({
      value: s.value,
      label: s.label,
      render: (
        <span className="flex items-center gap-2">
          <Badge variant={s.variant}>{s.label}</Badge>
        </span>
      ),
    })),
  ]

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
    setClientFilter("")
    setTbcFilter("")
    setTipoFilter("")
    setMethodFilter("")
    setDataserverProcessFilter("")
    setStatusFilter([])
    setMinDuration(0)
    setDateRange(undefined)
    pushParams({
      source: undefined,
      clientId: undefined,
      tbcId: undefined,
      tipo: undefined,
      method: undefined,
      dataserverProcess: undefined,
      status: undefined,
      minDuration: undefined,
      dateFrom: undefined,
      dateTo: undefined,
      page: 1,
    })
  }

  function applyFilters() {
    pushParams({
      source: sourceFilter || undefined,
      clientId: clientFilter || undefined,
      tbcId: tbcFilter || undefined,
      tipo: tipoFilter || undefined,
      method: methodFilter || undefined,
      dataserverProcess: dataserverProcessFilter || undefined,
      status: statusFilter.length ? statusFilter.join(",") : undefined,
      minDuration: minDuration || undefined,
      dateFrom: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined,
      dateTo: dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : undefined,
      page: 1,
    })
  }

  async function confirmReexecute() {
    const row = reexecuteRow
    if (!row || row.source !== "SOAP") return
    setExecuting(row.id)
    try {
      const result = await reexecuteSoapLog(row.id)
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
      setReexecuteRow(null)
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
        <Label>Tipo</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...tipoItems]}
          value={tipoFilter || "all"}
          onValueChange={(v) => {
            const next = !v || v === "all" ? "" : v
            setTipoFilter(next)
            // A dataserver/processo or método valid for the previous Tipo/Serviço may not exist
            // (or may not even apply) under the new one.
            setDataserverProcessFilter("")
            setMethodFilter("")
          }}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tipoItems.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Dataserver / Processo</Label>
        <Combobox
          items={dataserverProcessItems}
          value={dataserverProcessFilter}
          onValueChange={setDataserverProcessFilter}
          placeholder={dataserverProcessPlaceholder}
          disabled={dataserverProcessDisabled}
        />
      </div>
      <div className="space-y-2">
        <Label>Método</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...methodItems]}
          value={methodFilter || "all"}
          onValueChange={(v) => setMethodFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {methodItems.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <MultiSelect items={statusItems} value={statusFilter} onValueChange={setStatusFilter} placeholder="Todos" />
      </div>
      <div className="space-y-2">
        <Label>Duração mínima: {minDuration}s</Label>
        <Slider min={0} max={60} step={1} value={minDuration} onValueChange={setMinDuration} className="pt-2" />
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
    {
      id: "actions",
      cell: ({ row }) => {
        if (row.original.source !== "SOAP" || !canReexecuteSoap) return null
        return (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" onClick={() => setDetail(row.original)} title="Ver detalhes">
              <Eye className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={executing === row.original.id}
              onClick={() => setReexecuteRow(row.original)}
              title="Reexecutar"
            >
              <RotateCcw className={cn("h-4 w-4", executing === row.original.id && "animate-spin")} />
            </Button>
          </div>
        )
      },
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
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        onRowClick={(row) => setDetail(row)}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={(s) => pushParams({ sort: `${s.field}:${s.direction}`, page: 1 })}
        sortableColumns={SORTABLE_COLUMNS}
      />

      {reexecuteRow && (
        <ConfirmDialog
          open={!!reexecuteRow}
          onOpenChange={(open) => !executing && !open && setReexecuteRow(null)}
          title="Reexecutar chamada SOAP"
          description={`Isso vai reexecutar esta chamada SOAP, chamando primeiro AutenticaAcesso e CheckServiceActivity (conforme exigido pelo TOTVS) antes do método de destino.`}
          confirmLabel="Reexecutar"
          onConfirm={confirmReexecute}
          loading={!!executing}
          loadingLabel="Reexecutando..."
        />
      )}

      <ActivityDetailDialog open={!!detail} onOpenChange={(open) => !open && setDetail(null)} row={detail} />
    </>
  )
}

function ActivityDetailDialog({ open, onOpenChange, row }: { open: boolean; onOpenChange: (open: boolean) => void; row: ActivityRow | null }) {
  const [expanded, setExpanded] = useState(false)

  if (!row) return null

  const Icon = SOURCE_ICONS[row.source]

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setExpanded(false) }}>
      <DialogContent
        className={cn(
          expanded ? "h-[90vh]! max-h-[90vh]! w-[90vw]! max-w-[90vw]!" : "h-[70vh]! max-h-[70vh]! w-[70vw]! max-w-[70vw]!"
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
            {row.summary}
            <Badge variant="outline">{SOURCE_LABELS[row.source]}</Badge>
            <Badge variant={statusVariant(row.status)}>{statusLabel(row.status)}</Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Tamanho normal" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
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
          {row.source === "DELETION" && <DeletionDetail raw={row.raw as AuditLog} />}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}

function DataBlock({ label, value, language = "json" }: { label: string; value: unknown; language?: CodeEditorLanguage }) {
  if (value === null || value === undefined) return null
  const content = typeof value === "string" ? value : JSON.stringify(value, null, 2)
  if (!content) return null
  return (
    <div>
      {label && <p className="mb-1 text-xs text-muted-foreground">{label}</p>}
      <CodeEditor
        value={content}
        language={language}
        readOnly
        toolbar={false}
        minHeight="80px"
        className="[&_.cm-editor]:max-h-48 [&_.cm-scroller]:overflow-auto"
      />
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

function DeletionDetail({ raw }: { raw: AuditLog }) {
  const reasons = (raw.newData as { reasons?: BlockingReference[] } | null)?.reasons ?? []
  return (
    <div className="grid grid-cols-2 gap-3 text-sm">
      <div>
        <p className="text-xs text-muted-foreground">Cadastro</p>
        <p>{ENTITY_LABELS[raw.entity] ?? raw.entity}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">Registro</p>
        <p className="font-mono text-xs break-all">{raw.entityId}</p>
      </div>
      <div className="col-span-2">
        <p className="text-xs text-muted-foreground">Motivo / Vinculado a</p>
        <p>{formatBlockingReferences(reasons) || "-"}</p>
      </div>
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
      <Tabs defaultValue="request">
        <TabsList>
          <TabsTrigger value="request">XML Requisição</TabsTrigger>
          <TabsTrigger value="response-xml">XML Resposta</TabsTrigger>
          <TabsTrigger value="response-json">JSON Resposta</TabsTrigger>
        </TabsList>
        <TabsContent value="request">
          <DataBlock label="" value={raw.xmlRequest ? safeFormatXmlDeep(raw.xmlRequest) : null} language="xml" />
        </TabsContent>
        <TabsContent value="response-xml">
          <DataBlock label="" value={raw.xmlResponse ? safeFormatXmlDeep(raw.xmlResponse) : null} language="xml" />
        </TabsContent>
        <TabsContent value="response-json">
          <DataBlock label="" value={raw.jsonResponse} />
        </TabsContent>
      </Tabs>
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
