"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/shared/data-table"
import { CollapsibleCardHeader } from "@/components/shared/collapsible-card-header"
import { FileSpreadsheet, MoreHorizontal } from "lucide-react"
import { toast } from "sonner"
import { readNdjson, type TotvsAuditEvent } from "@/lib/ps-docs/field-search-stream"
import {
  auditRowsToSheetRows,
  pendingMessage,
  TOTVS_AUDIT_STATUSES,
  type TotvsAuditStatus,
  type TotvsFieldAuditRow,
} from "@/lib/ps-docs/totvs-field-audit"
import { downloadBlob } from "@/lib/ps-docs/download-utils"
import type { PsCredentials } from "@/lib/ps-docs/credential"

const STATUS_VARIANT: Record<TotvsAuditStatus, "success" | "secondary" | "destructive"> = {
  Configurado: "success",
  Incompleto: "secondary",
  "Não configurado": "destructive",
}

const dash = (value?: string) => value || "—"

/** Keeps the cell on one line at its natural width up to `max`; only text longer than that wraps
 *  to the next line, so no column grows past a standard width. */
function Capped({ children, max = "max-w-xs", className }: { children: React.ReactNode; max?: string; className?: string }) {
  return <div className={`w-max ${max} whitespace-normal break-words leading-snug ${className ?? ""}`}>{children}</div>
}

export interface TotvsFieldAuditState {
  rows: TotvsFieldAuditRow[]
  loading: boolean
  phase: { label: string; done: number; total: number } | null
  warnings: string[]
  ran: boolean
  /** Resolves true when the whole registry was read and at least one field came back. */
  run: (credentials: PsCredentials) => Promise<boolean>
}

/** Streams `POST /api/ps-field-totvs-audit` — rows show up as each field is read. A new run or
 *  leaving the page cancels the one in flight (and its Rubeus requests). */
export function useTotvsFieldAudit(): TotvsFieldAuditState {
  const [rows, setRows] = useState<TotvsFieldAuditRow[]>([])
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<TotvsFieldAuditState["phase"]>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [ran, setRan] = useState(false)
  const runRef = useRef<AbortController | null>(null)
  useEffect(() => () => runRef.current?.abort(), [])

  async function run(credentials: PsCredentials): Promise<boolean> {
    runRef.current?.abort()
    const controller = new AbortController()
    runRef.current = controller
    setRan(true)
    setLoading(true)
    setRows([])
    setWarnings([])
    setPhase({ label: "iniciando a leitura", done: 0, total: 0 })

    const collected: TotvsFieldAuditRow[] = []
    const collectedWarnings: string[] = []
    // One re-render per frame instead of one per streamed field.
    let frame = 0
    const showPartial = () => {
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (!controller.signal.aborted) setRows([...collected])
      })
    }

    try {
      const res = await fetch("/api/ps-field-totvs-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      })
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => undefined)) as { error?: string } | undefined
        toast.error(body?.error ?? `Falha na verificação (HTTP ${res.status})`)
        return false
      }
      let failure: string | undefined
      let finished = false
      await readNdjson<TotvsAuditEvent>(res.body, (event) => {
        switch (event.type) {
          case "progress":
            setPhase({ label: event.label, done: event.done, total: event.total })
            break
          case "rows":
            collected.push(...event.rows)
            showPartial()
            break
          case "warning":
            collectedWarnings.push(...event.messages)
            break
          case "done":
            finished = true
            break
          case "error":
            failure = event.error
            break
        }
      })
      cancelAnimationFrame(frame)
      if (controller.signal.aborted) return false
      collected.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
      setRows([...collected])
      setWarnings(collectedWarnings)
      if (failure || !finished) {
        toast.error(failure ?? "A verificação foi interrompida antes de terminar")
        return false
      }
      const pendentes = collected.filter((r) => r.status !== "Configurado").length
      toast.success(`${collected.length} campo(s) verificado(s) — ${pendentes} precisam de configuração`)
      if (collectedWarnings.length > 0)
        toast.warning(`${collectedWarnings.length} aviso(s) durante a leitura — confira abaixo da tabela.`)
      return collected.length > 0
    } catch (e) {
      if (!controller.signal.aborted) toast.error((e as Error).message)
      return false
    } finally {
      if (runRef.current === controller) {
        runRef.current = null
        setLoading(false)
        setPhase(null)
      }
    }
  }

  return { rows, loading, phase, warnings, ran, run }
}

/** Results of "Integração TOTVS dos campos": counts per status, the table and its XLSX export. */
export function TotvsFieldAuditResults({ audit }: { audit: TotvsFieldAuditState }) {
  const { rows, loading, warnings } = audit
  const [statusFilter, setStatusFilter] = useState("")
  const [textFilter, setTextFilter] = useState("")
  const [open, setOpen] = useState(true)

  const counts = useMemo(() => {
    const result: Record<TotvsAuditStatus, number> = { Configurado: 0, Incompleto: 0, "Não configurado": 0 }
    for (const r of rows) result[r.status]++
    return result
  }, [rows])

  const filteredRows = useMemo(() => {
    const text = textFilter.trim().toLowerCase()
    return rows.filter(
      (r) =>
        (!statusFilter || r.status === statusFilter) &&
        (!text ||
          [String(r.id), r.nome, r.tipo, r.tabela, r.campo, r.nomeAlternativo]
            .filter(Boolean)
            .some((v) => v!.toLowerCase().includes(text)))
    )
  }, [rows, statusFilter, textFilter])

  const columns = useMemo<ColumnDef<TotvsFieldAuditRow>[]>(
    () => [
      { accessorKey: "id", header: "ID" },
      {
        accessorKey: "nome",
        header: "Campo",
        cell: ({ row }) => (
          <Capped max="max-w-md" className="font-medium">
            {row.original.nome}
          </Capped>
        ),
      },
      { accessorKey: "tipo", header: "Tipo", cell: ({ row }) => <Capped>{row.original.tipo}</Capped> },
      { accessorKey: "tabelaPs", header: "Tabela do PS", cell: ({ row }) => <Capped>{dash(row.original.tabelaPs)}</Capped> },
      { accessorKey: "tabela", header: "Tabela TOTVS", cell: ({ row }) => <Capped>{dash(row.original.tabela)}</Capped> },
      { accessorKey: "campo", header: "Campo TOTVS", cell: ({ row }) => <Capped>{dash(row.original.campo)}</Capped> },
      {
        accessorKey: "nomeAlternativo",
        header: "Nome alternativo",
        cell: ({ row }) => <Capped>{dash(row.original.nomeAlternativo)}</Capped>,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
      },
      {
        id: "faltando",
        accessorFn: (r) => pendingMessage(r),
        header: "O que falta",
        // One short chip per missing item; the full sentence stays in the tooltip and the XLSX.
        cell: ({ row }) =>
          row.original.faltando.length === 0 ? (
            dash()
          ) : (
            <div className="flex w-max max-w-xs flex-wrap gap-1" title={pendingMessage(row.original)}>
              {row.original.faltando.map((item) => (
                <Badge key={item} variant="outline" className="font-normal">
                  {item}
                </Badge>
              ))}
            </div>
          ),
      },
    ],
    []
  )

  async function exportXlsx() {
    try {
      const XLSX = await import("xlsx")
      const sheetRows = auditRowsToSheetRows(filteredRows)
      const sheet = XLSX.utils.json_to_sheet(sheetRows)
      const headers = Object.keys(sheetRows[0] ?? {})
      sheet["!cols"] = headers.map((h) => ({
        wch: Math.min(60, Math.max(h.length, ...sheetRows.map((r) => String(r[h] ?? "").length)) + 2),
      }))
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, sheet, "Integração TOTVS")
      const data = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
      downloadBlob(
        new Blob([data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }),
        "integracao-totvs-dos-campos.xlsx"
      )
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`)
    }
  }

  const filterPanel = (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[{ value: "all", label: "Todos" }, ...TOTVS_AUDIT_STATUSES.map((s) => ({ value: s, label: s }))]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {TOTVS_AUDIT_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )

  return (
    <>
      <Card>
        <CollapsibleCardHeader
          title={
            <>
              {loading ? "Verificando" : `${filteredRows.length} campo(s)`}
              {filteredRows.length !== rows.length && ` (de ${rows.length})`}
            </>
          }
          open={open}
          onToggle={() => setOpen((o) => !o)}
          controlsId="ps-field-totvs-audit-results"
          expandLabel="Expandir resultados"
          collapseLabel="Recolher resultados"
        />
        <CardContent id="ps-field-totvs-audit-results" hidden={!open} className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {TOTVS_AUDIT_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter((current) => (current === s ? "" : s))}
                aria-pressed={statusFilter === s}
                className="cursor-pointer"
              >
                <Badge variant={statusFilter === s ? STATUS_VARIANT[s] : "outline"}>
                  {s}: {counts[s]}
                </Badge>
              </button>
            ))}
          </div>
          <DataTable
            columns={columns}
            data={filteredRows}
            loading={loading && rows.length === 0}
            refreshing={loading && rows.length > 0}
            searchPlaceholder="Filtrar campos..."
            toolbarActions={
              <DropdownMenu>
                <DropdownMenuTrigger
                  disabled={loading || filteredRows.length === 0}
                  render={
                    <Button variant="outline" size="sm" className="h-9">
                      <MoreHorizontal className="h-4 w-4" /> Ações
                    </Button>
                  }
                />
                <DropdownMenuContent align="end" className="w-auto min-w-44 whitespace-nowrap">
                  <DropdownMenuItem onClick={exportXlsx}>
                    <FileSpreadsheet className="h-4 w-4" /> Exportar XLSX
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
            onSearch={setTextFilter}
            filterPanel={filterPanel}
            sortableColumns={[
              "id",
              "nome",
              "tipo",
              "tabelaPs",
              "tabela",
              "campo",
              "nomeAlternativo",
              "status",
              "faltando",
            ]}
            pageSize={25}
            emptyMessage={loading ? "Lendo o cadastro de campos..." : "Nenhum campo encontrado."}
          />
        </CardContent>
      </Card>

      {warnings.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <details>
              <summary className="cursor-pointer text-sm font-medium">
                {warnings.length} aviso(s) durante a leitura dos campos
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </details>
          </CardContent>
        </Card>
      )}
    </>
  )
}
