"use client"

import { useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Download, Loader2, Play, RotateCw } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { ChecklistContextFields } from "@/components/tbc-checklist/checklist-context-fields"
import { downloadCsv } from "@/components/tbc-permissions/csv"
import { validateTbcDataserver, type DataserverCheckResult } from "@/actions/integrations/tbc-permissions"
import type { DataserverProbe, PermissionModel } from "@/config/tbc-permission-models/types"
import { EMPTY_CONTEXT_FORM, toChecklistContext, type ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"
import type { TbcRow } from "@/services/tbc.service"

type RowState = DataserverCheckResult | { status: "running" } | { status: "pending" }
type Status = RowState["status"]
type ProbeRow = DataserverProbe & { state: RowState }
type SortState = { field: string; direction: "asc" | "desc" }

const STATUS_LABELS: Record<Status, string> = {
  ok: "Liberado",
  denied: "Negado",
  error: "Erro",
  running: "Validando…",
  pending: "Não validado",
}

const STATUS_VARIANT = {
  ok: "success",
  denied: "destructive",
  error: "destructive",
  running: "outline",
  pending: "outline",
} as const

const FILTER_STATUSES = ["ok", "denied", "error", "pending"] as const

/** Calls in flight at once — each one is an authenticated SOAP round-trip to the client's TBC. */
const CONCURRENCY = 4

interface DataserversTabProps {
  tbc: TbcRow
  model: PermissionModel
}

/** Live read-only probe (GetSchema + ReadView `1=0`) of every Data Server the model needs. */
export function DataserversTab({ tbc, model }: DataserversTabProps) {
  const [contextForm, setContextForm] = useState<ChecklistContextForm>(EMPTY_CONTEXT_FORM)
  const [states, setStates] = useState<Record<string, RowState>>({})
  const [running, setRunning] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [draftStatus, setDraftStatus] = useState("")
  const [sort, setSort] = useState<SortState>({ field: "group", direction: "asc" })
  // Bumped on every "Validar todos" so responses of an older run never overwrite a newer one.
  const runRef = useRef(0)
  const probes = model.dataservers

  const rows = useMemo<ProbeRow[]>(() => {
    const term = search.trim().toLowerCase()
    const list = probes
      .map((p) => ({ ...p, state: states[p.code] ?? { status: "pending" as const } }))
      .filter((r) => !statusFilter || r.state.status === statusFilter)
      .filter((r) => !term || [r.code, r.label, r.group].some((v) => v.toLowerCase().includes(term)))
    const value = (r: ProbeRow) => (sort.field === "status" ? STATUS_LABELS[r.state.status] : String(r[sort.field as keyof DataserverProbe] ?? ""))
    const dir = sort.direction === "asc" ? 1 : -1
    return list.sort((a, b) => value(a).localeCompare(value(b), "pt-BR") * dir)
  }, [probes, states, search, statusFilter, sort])

  const counts = useMemo(() => {
    const c = { ok: 0, denied: 0, error: 0 }
    for (const s of Object.values(states)) if (s.status in c) c[s.status as keyof typeof c]++
    return c
  }, [states])

  async function validate(items: DataserverProbe[], run: number) {
    const context = toChecklistContext(contextForm) ?? undefined
    setStates((prev) => ({ ...prev, ...Object.fromEntries(items.map((p) => [p.code, { status: "running" as const }])) }))
    let next = 0
    async function worker() {
      while (next < items.length) {
        const item = items[next++]
        let result: DataserverCheckResult
        try {
          result = await validateTbcDataserver({ tbcId: tbc.id, dataserverCode: item.code, context })
        } catch (error) {
          result = { status: "error", message: (error as Error).message, duration: 0 }
        }
        if (runRef.current !== run) return
        setStates((prev) => ({ ...prev, [item.code]: result }))
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker))
  }

  async function validateAll() {
    const run = ++runRef.current
    setRunning(true)
    try {
      await validate(probes, run)
      if (runRef.current === run) toast.success("Validação dos Data Servers concluída.")
    } finally {
      if (runRef.current === run) setRunning(false)
    }
  }

  function exportCsv() {
    downloadCsv(
      ["Grupo", "Data Server", "Descrição", "Status", "Mensagem"],
      probes.map((p) => {
        const state = states[p.code] ?? { status: "pending" as const }
        return [p.group, p.code, p.label, STATUS_LABELS[state.status], "message" in state ? state.message ?? "" : ""]
      }),
      `dataservers-${model.key}-${tbc.name}`
    )
  }

  const columns: ColumnDef<ProbeRow>[] = [
    { accessorKey: "group", header: "Grupo" },
    { accessorKey: "code", header: "Data Server", cell: ({ row }) => <span className="font-mono text-xs">{row.original.code}</span> },
    { accessorKey: "label", header: "Descrição" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const { state } = row.original
        return (
          <Badge variant={STATUS_VARIANT[state.status]}>
            {state.status === "running" && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
            {STATUS_LABELS[state.status]}
          </Badge>
        )
      },
    },
    {
      id: "message",
      header: "Detalhe",
      cell: ({ row }) => {
        const { state } = row.original
        return "message" in state && state.message ? (
          <WithTooltip label={state.message}>
            <span className="line-clamp-2 max-w-md text-xs text-muted-foreground">{state.message}</span>
          </WithTooltip>
        ) : null
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <WithTooltip label="Validar novamente">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Validar novamente"
            disabled={row.original.state.status === "running"}
            onClick={() => validate([row.original], runRef.current)}
          >
            <RotateCw className="h-4 w-4" />
          </Button>
        </WithTooltip>
      ),
    },
  ]

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() => setStatusFilter(draftStatus)}
      onClear={() => {
        setDraftStatus("")
        setStatusFilter("")
      }}
    >
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...FILTER_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          value={draftStatus || "all"}
          onValueChange={(v) => setDraftStatus(v === "all" || !v ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {FILTER_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border p-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="lg:w-[520px]">
          <p className="mb-1 text-sm font-medium">Contexto (opcional)</p>
          <p className="mb-2 text-xs text-muted-foreground">Alguns Data Servers do Educacional exigem coligada/filial/tipo de curso.</p>
          <ChecklistContextFields value={contextForm} onChange={setContextForm} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportCsv}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button onClick={validateAll} disabled={running}>
            {running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Validar todos
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="success">{counts.ok} liberados</Badge>
        <Badge variant="destructive">{counts.denied} negados</Badge>
        <Badge variant="destructive">{counts.error} com erro</Badge>
        <Badge variant="outline">{probes.length} no total</Badge>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        pageSize={50}
        searchPlaceholder="Buscar por Data Server, descrição ou grupo..."
        onSearch={setSearch}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={setSort}
        sortableColumns={["group", "code", "label", "status"]}
        emptyMessage="Nenhum Data Server para os filtros aplicados."
      />
    </div>
  )
}
