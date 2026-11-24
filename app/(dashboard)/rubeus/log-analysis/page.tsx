"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { format } from "date-fns"
import { AlertTriangle, ClipboardCopy, FileSpreadsheet, Loader2, ScrollText, Search, Building2 } from "lucide-react"
import { fetchLogPortals, fetchLogProcesses, searchRubeusLogs } from "@/actions/integrations/rubeus-logs"
import { CredentialsFields } from "@/components/ps-docs/credentials-fields"
import { LogDetailDialog } from "@/components/rubeus-logs/log-detail-dialog"
import { DataTable } from "@/components/shared/data-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Combobox } from "@/components/ui/combobox"
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker"
import { Field, FieldLabel } from "@/components/ui/field"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { hasRequiredCredentials, missingCookieNames, parseCookieString, type PsCredentials } from "@/lib/ps-docs/credential"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import {
  LOG_SHEET_HEADERS,
  dash,
  durationSeconds,
  formatDurationSeconds,
  formatLogDate,
  isErrorLog,
  logTypeLabel,
  logsToSheetRows,
  toTsv,
} from "@/lib/rubeus-logs/format"
import type { LogTypeFilter, RubeusLogCategory, RubeusLogRow } from "@/lib/rubeus-logs/types"
import { toast } from "@/lib/toast"

const TYPE_OPTIONS: { value: LogTypeFilter; label: string }[] = [
  { value: "error", label: "Erro" },
  { value: "info", label: "Info" },
  { value: "all", label: "Erro e info" },
]

type Portal = { id: number; title: string }
type Process = { id: number; name: string }
/** `from`/`to` absent = no period (Rubeus returns the most recent logs). */
type Searched = { portal: Portal; process: Process | null; from?: string; to?: string; type: LogTypeFilter; minDuration: number }

const MAX_DURATION_S = 30
const ddmmyyyy = (iso: string) => iso.split("-").reverse().join("/")

function periodLabel(s: Searched) {
  if (!s.from || !s.to) return "mais recentes"
  return s.from === s.to ? ddmmyyyy(s.from) : `${ddmmyyyy(s.from)} a ${ddmmyyyy(s.to)}`
}

const today = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const noopSubscribe = () => () => {}

export default function LogAnalysisPage() {
  // "Today" only exists in the browser's timezone — on the server (UTC) it can be another day.
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false)
  const [cookie, setCookie] = useState("")
  const [portals, setPortals] = useState<Portal[] | null>(null)
  const [loadingPortals, setLoadingPortals] = useState(false)
  const [portalId, setPortalId] = useState<string>("")
  const [type, setType] = useState<LogTypeFilter>("error")
  const [processes, setProcesses] = useState<Process[] | null>(null)
  const [loadingProcesses, setLoadingProcesses] = useState(false)
  const [processId, setProcessId] = useState<string>("")
  const [minDuration, setMinDuration] = useState(0)
  // "default" = today–today (resolved on the client); `undefined` = no period (most recent logs).
  const [rangeState, setRange] = useState<DateRange | undefined | "default">("default")
  const range = rangeState === "default" ? (hydrated ? { from: today(), to: today() } : undefined) : rangeState

  const [logs, setLogs] = useState<RubeusLogRow[]>([])
  const [categories, setCategories] = useState<RubeusLogCategory[]>([])
  const [searched, setSearched] = useState<Searched | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  // Credentials used by the last search — the detail dialog reuses them, even if the textarea changes.
  const [searchCredentials, setSearchCredentials] = useState<PsCredentials | null>(null)

  const [categoryFilter, setCategoryFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [selected, setSelected] = useState<RubeusLogRow | null>(null)

  const credentials = useMemo(() => parseCookieString(cookie), [cookie])
  const cookieReady = !!cookie.trim() && missingCookieNames(cookie).length === 0 && hasRequiredCredentials(credentials)

  async function loadPortals() {
    if (!cookieReady) {
      toast.error("Cole o cookie completo da sessão do portal admin")
      return
    }
    setLoadingPortals(true)
    try {
      const res = await fetchLogPortals({ credentials })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setPortals(res.portals)
      if (res.warning) toast.warning(res.warning)
      if (res.portals.length === 1) void selectPortal(String(res.portals[0].id))
      else if (portalId && !res.portals.some((p) => String(p.id) === portalId)) void selectPortal("")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingPortals(false)
    }
  }

  /** Choosing a portal resets the process and loads that portal's processes. */
  async function selectPortal(id: string) {
    setPortalId(id)
    setProcessId("")
    setProcesses(null)
    if (!id) return
    setLoadingProcesses(true)
    try {
      const res = await fetchLogProcesses({ credentials, portalId: Number(id) })
      if (!res.success) {
        toast.error(res.error)
        return
      }
      setProcesses(res.processes)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoadingProcesses(false)
    }
  }

  async function search() {
    const portal = portals?.find((p) => String(p.id) === portalId)
    if (!cookieReady) return void toast.error("Cole o cookie completo da sessão do portal admin")
    if (!portal) return void toast.error("Selecione o portal")
    const process = processes?.find((p) => String(p.id) === processId) ?? null
    const from = range?.from ? format(range.from, "yyyy-MM-dd") : undefined
    const to = range?.from ? format(range.to ?? range.from, "yyyy-MM-dd") : undefined

    setSearching(true)
    setSearchError(null)
    try {
      const res = await searchRubeusLogs({
        credentials,
        type,
        from,
        to,
        portalId: portal.id,
        selectiveProcessId: process?.id,
        minDurationMs: minDuration > 0 ? minDuration * 1000 : undefined,
      })
      if (!res.success) {
        setSearchError(res.error)
        toast.error(res.error)
        return
      }
      setLogs(res.logs)
      setCategories(res.categories)
      setSearched({ portal, process, from, to, type, minDuration })
      setSearchCredentials(credentials)
      setCategoryFilter("")
      setTypeFilter("")
      if (res.logs.length === 0) toast.info("Nenhum log encontrado para os filtros informados")
    } catch (e) {
      setSearchError((e as Error).message)
      toast.error((e as Error).message)
    } finally {
      setSearching(false)
    }
  }

  const filteredLogs = useMemo(
    () =>
      logs.filter(
        (l) =>
          (!categoryFilter || l.categories_id === categoryFilter) &&
          (!typeFilter || (typeFilter === "error" ? isErrorLog(l.log_type_id) : !isErrorLog(l.log_type_id)))
      ),
    [logs, categoryFilter, typeFilter]
  )

  // Categories present in the result first (with the API catalog as names/fallback).
  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const l of logs) if (l.categories_id) map.set(l.categories_id, l.categories_title ?? `Categoria ${l.categories_id}`)
    for (const c of categories) if (!map.has(String(c.id)) && logs.length === 0) map.set(String(c.id), c.title)
    return [...map.entries()].map(([value, label]) => ({ value, label })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"))
  }, [logs, categories])

  const portalFallback = searched?.portal.title ?? ""
  const errorCount = useMemo(() => filteredLogs.filter((l) => isErrorLog(l.log_type_id)).length, [filteredLogs])

  const baseFileName = searched
    ? `logs-${slugify(searched.portal.title) || searched.portal.id}-${searched.process ? `ps${searched.process.id}-` : ""}${searched.from && searched.to ? `${searched.from}_${searched.to}` : "recentes"}`
    : "logs"

  async function exportXlsx() {
    try {
      const XLSX = await import("xlsx")
      const rows = logsToSheetRows(filteredLogs, portalFallback)
      const sheet = XLSX.utils.aoa_to_sheet([[...LOG_SHEET_HEADERS], ...rows])
      sheet["!cols"] = LOG_SHEET_HEADERS.map((h, i) => ({ wch: Math.min(60, Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)) + 2) }))
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Logs")
      const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
      downloadBlob(new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${baseFileName}.xlsx`)
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`)
    }
  }

  async function copyForSheets() {
    try {
      await navigator.clipboard.writeText(toTsv(LOG_SHEET_HEADERS, logsToSheetRows(filteredLogs, portalFallback)))
      toast.success(`${filteredLogs.length} log(s) copiados — cole no Google Sheets (Ctrl+V)`)
    } catch {
      toast.error("Não foi possível copiar para a área de transferência")
    }
  }

  const columns = useMemo<ColumnDef<RubeusLogRow>[]>(
    () => [
      { accessorKey: "id", header: "ID", meta: { width: 110 } },
      {
        id: "tipo",
        accessorFn: (r) => logTypeLabel(r.log_type_id),
        header: "Tipo",
        meta: { width: 90, exportValue: (r) => logTypeLabel(r.log_type_id) },
        cell: ({ row }) => (
          <Badge variant={isErrorLog(row.original.log_type_id) ? "destructive" : "secondary"}>{logTypeLabel(row.original.log_type_id)}</Badge>
        ),
      },
      {
        accessorKey: "created_at",
        header: "Criado em",
        meta: { width: 170, exportValue: (r) => formatLogDate(r.created_at) },
        cell: ({ row }) => formatLogDate(row.original.created_at),
      },
      {
        accessorKey: "categories_title",
        header: "Categoria",
        meta: { minWidth: 180, exportValue: (r) => dash(r.categories_title) },
        cell: ({ row }) => dash(row.original.categories_title),
      },
      {
        accessorKey: "description",
        header: "Descrição",
        meta: { minWidth: 200, exportValue: (r) => dash(r.description) },
        cell: ({ row }) => dash(row.original.description),
      },
      {
        id: "portal",
        accessorFn: (r) => r.portal_title || portalFallback,
        header: "Portal",
        meta: { minWidth: 180, exportValue: (r) => dash(r.portal_title || portalFallback) },
        cell: ({ row }) => dash(row.original.portal_title || portalFallback),
      },
      {
        accessorKey: "selective_process_title",
        header: "Processo seletivo",
        meta: { minWidth: 200, exportValue: (r) => dash(r.selective_process_title) },
        cell: ({ row }) =>
          row.original.selective_process_title ? (
            <span title={row.original.selective_process_id ? `ID ${row.original.selective_process_id}` : undefined}>{row.original.selective_process_title}</span>
          ) : (
            "-"
          ),
      },
      {
        accessorKey: "person_name",
        header: "Pessoa",
        meta: { minWidth: 180, exportValue: (r) => dash(r.person_name) },
        cell: ({ row }) => dash(row.original.person_name),
      },
      {
        id: "duracao",
        accessorFn: (r) => durationSeconds(r.duration) ?? -1,
        header: "Duração",
        meta: { width: 140, align: "right", exportValue: (r) => durationSeconds(r.duration) ?? "-" },
        cell: ({ row }) => formatDurationSeconds(row.original.duration),
      },
    ],
    [portalFallback]
  )

  const filterPanel = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Field>
        <FieldLabel>Categoria</FieldLabel>
        <Select
          items={[{ value: "all", label: "Todas" }, ...categoryOptions]}
          value={categoryFilter || "all"}
          onValueChange={(v) => setCategoryFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categoryOptions.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Tipo</FieldLabel>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "error", label: "Erro" },
            { value: "info", label: "Info" },
          ]}
          value={typeFilter || "all"}
          onValueChange={(v) => setTypeFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="error">Erro</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  )

  const noRows = filteredLogs.length === 0

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ScrollText className="h-5 w-5" /> Análise de logs
        </h1>
        <p className="text-sm text-muted-foreground">
          Busque os logs de integração de um portal Rubeus por processo seletivo, tipo, período e duração, abra cada log para ver os dados enviados e retornados, e exporte a
          lista para Excel ou Google Sheets.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialsFields value={cookie} onChange={setCookie} />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={loadPortals} disabled={!cookieReady || loadingPortals}>
              {loadingPortals ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
              {portals ? "Recarregar portais" : "Carregar portais"}
            </Button>
            {portals && <span className="text-sm text-muted-foreground">{portals.length} portal(is) ativo(s)</span>}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,0.7fr)_minmax(15rem,1.2fr)]">
            <Field>
              <FieldLabel>Portal *</FieldLabel>
              <Combobox
                items={(portals ?? []).map((p) => ({ value: String(p.id), label: `${p.title} (${p.id})` }))}
                value={portalId}
                onValueChange={(v) => void selectPortal(v ?? "")}
                placeholder={portals ? "Selecione o portal" : "Carregue os portais"}
                disabled={!portals || portals.length === 0}
              />
            </Field>
            <Field>
              <FieldLabel>Processo seletivo</FieldLabel>
              <Combobox
                items={(processes ?? []).map((p) => ({ value: String(p.id), label: `${p.name} (${p.id})` }))}
                value={processId}
                onValueChange={(v) => setProcessId(v ?? "")}
                placeholder={loadingProcesses ? "Carregando processos..." : !portalId ? "Selecione o portal" : "Todos"}
                disabled={!portalId || loadingProcesses || !processes}
              />
            </Field>
            <Field>
              <FieldLabel>Tipo *</FieldLabel>
              <Select items={TYPE_OPTIONS} value={type} onValueChange={(v) => v && setType(v as LogTypeFilter)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel>Período</FieldLabel>
              <DateRangePicker value={range} onValueChange={setRange} placeholder="Mais recentes" className="w-full" />
            </Field>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="w-full max-w-sm">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Duração mínima</span>
                <span className="font-medium">{minDuration > 0 ? `≥ ${minDuration}s` : "Qualquer"}</span>
              </div>
              <Slider
                min={0}
                max={MAX_DURATION_S}
                step={1}
                value={minDuration}
                onValueChange={(v: number) => setMinDuration(v)}
                valueLabelFormat={(v) => `${v}s`}
                aria-label="Duração mínima em segundos"
              />
            </div>
            <Button onClick={search} disabled={searching || !cookieReady || !portalId}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Buscar logs
            </Button>
          </div>

          {searchError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{searchError}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {(searched || searching) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2">
              Logs
              {searched && (
                <span className="text-sm font-normal text-muted-foreground">
                  {searched.portal.title}
                  {searched.process ? ` · ${searched.process.name}` : ""} · {periodLabel(searched)}
                  {searched.minDuration > 0 ? ` · ≥ ${searched.minDuration}s` : ""} ·{" "}
                  {filteredLogs.length} log(s){errorCount > 0 ? `, ${errorCount} erro(s)` : ""}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              data={filteredLogs}
              loading={searching && logs.length === 0}
              refreshing={searching && logs.length > 0}
              searchPlaceholder="Filtrar logs..."
              pageSize={25}
              filterPanel={filterPanel}
              onRowClick={setSelected}
              toolbarActions={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="h-9" onClick={copyForSheets} disabled={searching || noRows}>
                    <ClipboardCopy className="size-4" /> Copiar p/ Google Sheets
                  </Button>
                  <Button variant="outline" size="sm" className="h-9" onClick={exportXlsx} disabled={searching || noRows}>
                    <FileSpreadsheet className="size-4" /> Baixar Excel
                  </Button>
                </div>
              }
              emptyMessage={searching ? "Buscando logs..." : "Nenhum log encontrado."}
            />
          </CardContent>
        </Card>
      )}

      <LogDetailDialog row={selected} credentials={searchCredentials} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  )
}
