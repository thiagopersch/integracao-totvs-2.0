"use client"

import { useMemo, useState } from "react"
import { AlertCircle, AlertTriangle, ArrowDownToLine, CheckCircle2, Info, Loader2, Maximize2, Minimize2, Search } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxItem } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { DatePicker } from "@/components/ui/date-picker"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { cn } from "@/lib/utils"
import { commitDemandImport } from "@/actions/import"
import type { ParsedDemandRow } from "@/schemas/demand-import.schema"

const PRIORITY_OPTIONS: ComboboxItem[] = [
  { value: "LOW", label: "Baixa" },
  { value: "MEDIUM", label: "Média" },
  { value: "HIGH", label: "Alta" },
  { value: "URGENT", label: "Urgente" },
]

const STATUS_OPTIONS: ComboboxItem[] = [
  { value: "PENDING", label: "Pendente" },
  { value: "IN_PROGRESS", label: "Em Andamento" },
  { value: "COMPLETED", label: "Concluída" },
  { value: "CANCELLED", label: "Cancelada" },
]

const PRIORITY_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(PRIORITY_OPTIONS.map((o) => [o.value, o.label]))
const STATUS_LABEL_BY_VALUE: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]))

/** Columns that support "apply this cell's value to every row below it in the same column". */
type FillDownField = "clientId" | "analystId" | "requesterId" | "departmentId" | "demandTypeId" | "priority" | "status"

const FILL_DOWN_COLUMN_LABELS: Record<FillDownField, string> = {
  clientId: "Cliente",
  analystId: "Analista",
  requesterId: "Solicitante",
  departmentId: "Setor",
  demandTypeId: "Tipo de Demanda",
  priority: "Prioridade",
  status: "Status",
}

type ErrorField = "date" | "hours" | "name" | "description" | "clientId" | "analystId" | "demandTypeId"

const INVALID_CELL_CLASS = "bg-red-100/70 dark:bg-red-900/30"

interface EditableRow {
  rowNumber: number
  sourceLabel: string
  date: string // yyyy-mm-dd, for DatePicker
  clientId: string
  analystId: string
  requesterId: string
  departmentId: string
  demandTypeId: string
  name: string
  description: string
  hours: string
  priority: string
  status: string
  clientHint: string
  analystHint: string
}

function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ""
}

function initialRow(row: ParsedDemandRow): EditableRow {
  return {
    rowNumber: row.rowNumber,
    sourceLabel: row.sourceLabel,
    date: toDateInputValue(row.date.parsed),
    clientId: row.client.status === "matched" ? (row.client.matchedId ?? "") : "",
    analystId: row.analyst.status === "matched" ? (row.analyst.matchedId ?? "") : "",
    requesterId: row.requester.status === "matched" ? (row.requester.matchedId ?? "") : "",
    departmentId: row.department.status === "matched" ? (row.department.matchedId ?? "") : "",
    demandTypeId: row.demandType.status === "matched" ? (row.demandType.matchedId ?? "") : "",
    name: row.name,
    description: row.description,
    hours: row.hours.parsed !== null ? String(row.hours.parsed) : row.hours.raw,
    priority: row.priority,
    status: row.status,
    clientHint: row.client.rawValue,
    analystHint: row.analyst.rawValue,
  }
}

function rowFieldErrors(row: EditableRow): Partial<Record<ErrorField, string>> {
  const errors: Partial<Record<ErrorField, string>> = {}
  if (!row.date) errors.date = "Data inválida"
  const hours = parseFloat(row.hours.replace(",", "."))
  if (!row.hours || Number.isNaN(hours) || hours <= 0) errors.hours = "Horas inválidas"
  if (!row.name.trim()) errors.name = "Nome é obrigatório"
  if (!row.description.trim()) errors.description = "Descrição é obrigatória"
  if (!row.clientId) errors.clientId = "Cliente não identificado"
  if (!row.analystId) errors.analystId = "Analista não identificado"
  if (!row.demandTypeId) errors.demandTypeId = "Tipo de demanda não identificado"
  return errors
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileName: string
  parsedRows: ParsedDemandRow[]
  clients: ComboboxItem[]
  analysts: ComboboxItem[]
  requesters: ComboboxItem[]
  departments: ComboboxItem[]
  demandTypes: ComboboxItem[]
  onImported: () => void
}

export function DemandImportReviewDialog({
  open,
  onOpenChange,
  fileName,
  parsedRows,
  clients,
  analysts,
  requesters,
  departments,
  demandTypes,
  onImported,
}: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() => parsedRows.map(initialRow))
  const [wasOpen, setWasOpen] = useState(open)
  const [submitting, setSubmitting] = useState(false)
  const [serverRowErrors, setServerRowErrors] = useState<Record<number, string>>({})
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState("")
  const [fillDownRequest, setFillDownRequest] = useState<{
    field: FillDownField
    rowNumber: number
    value: string
    label: string
  } | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRows(parsedRows.map(initialRow))
      setServerRowErrors({})
      setSearch("")
    } else {
      setExpanded(false)
      setFillDownRequest(null)
    }
  }

  function updateRow(rowNumber: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)))
  }

  const clientLabels = useMemo(() => new Map(clients.map((c) => [c.value, c.label])), [clients])
  const analystLabels = useMemo(() => new Map(analysts.map((a) => [a.value, a.label])), [analysts])
  const requesterLabels = useMemo(() => new Map(requesters.map((r) => [r.value, r.label])), [requesters])
  const departmentLabels = useMemo(() => new Map(departments.map((d) => [d.value, d.label])), [departments])
  const demandTypeLabels = useMemo(() => new Map(demandTypes.map((t) => [t.value, t.label])), [demandTypes])

  const errorsByRow = useMemo(() => {
    const map = new Map<number, { fields: Partial<Record<ErrorField, string>>; messages: string[] }>()
    for (const row of rows) {
      const fields = rowFieldErrors(row)
      const messages = Object.values(fields) as string[]
      const serverError = serverRowErrors[row.rowNumber]
      if (serverError) messages.push(serverError)
      map.set(row.rowNumber, { fields, messages })
    }
    return map
  }, [rows, serverRowErrors])

  const readyCount = rows.filter((r) => (errorsByRow.get(r.rowNumber)?.messages ?? []).length === 0).length
  const hasBlockingErrors = readyCount < rows.length

  const filteredRows = useMemo(() => {
    const term = normalize(search.trim())
    if (!term) return rows
    return rows.filter((row) => {
      const haystack = [
        row.sourceLabel,
        row.date,
        clientLabels.get(row.clientId) ?? row.clientHint,
        analystLabels.get(row.analystId) ?? row.analystHint,
        requesterLabels.get(row.requesterId),
        departmentLabels.get(row.departmentId),
        demandTypeLabels.get(row.demandTypeId),
        row.name,
        row.description,
        row.hours,
        PRIORITY_LABEL_BY_VALUE[row.priority],
        STATUS_LABEL_BY_VALUE[row.status],
      ]
        .filter(Boolean)
        .join(" ")
      return normalize(haystack).includes(term)
    })
  }, [rows, search, clientLabels, analystLabels, requesterLabels, departmentLabels, demandTypeLabels])

  function requestFillDown(field: FillDownField, row: EditableRow) {
    const value = row[field]
    if (!value) return
    const labelMaps: Record<FillDownField, Map<string, string> | Record<string, string>> = {
      clientId: clientLabels,
      analystId: analystLabels,
      requesterId: requesterLabels,
      departmentId: departmentLabels,
      demandTypeId: demandTypeLabels,
      priority: PRIORITY_LABEL_BY_VALUE,
      status: STATUS_LABEL_BY_VALUE,
    }
    const source = labelMaps[field]
    const label = (source instanceof Map ? source.get(value) : source[value]) ?? value
    setFillDownRequest({ field, rowNumber: row.rowNumber, value, label })
  }

  function applyFillDown() {
    if (!fillDownRequest) return
    const { field, rowNumber, value } = fillDownRequest
    const visibleRowNumbers = new Set(filteredRows.map((r) => r.rowNumber))
    setRows((prev) => {
      const originIndex = prev.findIndex((r) => r.rowNumber === rowNumber)
      return prev.map((r, index) =>
        index > originIndex && visibleRowNumbers.has(r.rowNumber) ? { ...r, [field]: value } : r
      )
    })
    setFillDownRequest(null)
  }

  function renderFillDownButton(field: FillDownField, row: EditableRow) {
    if (!row[field]) return null
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
        title={`Aplicar este valor a todas as linhas abaixo (${FILL_DOWN_COLUMN_LABELS[field]})`}
        onClick={() => requestFillDown(field, row)}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
      </Button>
    )
  }

  async function handleConfirm() {
    setSubmitting(true)
    setServerRowErrors({})
    try {
      const payload = {
        rows: rows.map((r) => ({
          rowNumber: r.rowNumber,
          date: new Date(`${r.date}T00:00:00.000Z`).toISOString(),
          clientId: r.clientId,
          analystId: r.analystId,
          requesterId: r.requesterId || undefined,
          departmentId: r.departmentId || undefined,
          demandTypeId: r.demandTypeId,
          name: r.name.trim(),
          description: r.description.trim(),
          hours: parseFloat(r.hours.replace(",", ".")),
          priority: r.priority,
          status: r.status,
        })),
      }

      const result = await commitDemandImport(payload)
      if (!result.success) {
        if (result.rowErrors?.length) {
          setServerRowErrors(Object.fromEntries(result.rowErrors.map((e) => [e.rowNumber, e.message])))
        }
        toast.error(result.error || "Erro ao importar demandas")
        return
      }

      const parts: string[] = []
      if (result.createdCount) parts.push(`${result.createdCount} criada(s)`)
      if (result.updatedCount) parts.push(`${result.updatedCount} atualizada(s)`)
      toast.success(`Importação concluída: ${parts.join(", ") || "nenhuma alteração"}`)
      onOpenChange(false)
      onImported()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            expanded ? "h-[99vh]! max-h-[99vh]! w-[99vw]! max-w-[99vw]!" : "w-[95vw] max-w-[95vw]",
            "[&_[data-slot=dialog-close]]:text-red-500 [&_[data-slot=dialog-close]]:hover:text-red-600"
          )}
          headerActions={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setExpanded((v) => !v)}
              title={expanded ? "Tamanho normal" : "Expandir"}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          }
        >
          <DialogHeader>
            <DialogTitle>Revisar importação — {fileName}</DialogTitle>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <Info className="h-4 w-4 mt-0.5 shrink-0" />
              Linhas com data, cliente, analista, nome, horas, solicitante e setor iguais aos de uma demanda já existente
              serão atualizadas (sobrescritas) automaticamente ao final da importação.
            </p>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar em qualquer campo da tabela..."
                className="pl-8"
              />
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="min-w-32">Origem</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="min-w-48">Cliente</TableHead>
                  <TableHead className="min-w-48">Analista</TableHead>
                  <TableHead className="min-w-48">Solicitante</TableHead>
                  <TableHead className="min-w-48">Setor</TableHead>
                  <TableHead className="min-w-64">Nome</TableHead>
                  <TableHead className="min-w-64">Descrição</TableHead>
                  <TableHead className="w-24">Horas</TableHead>
                  <TableHead className="min-w-48">Tipo de Demanda</TableHead>
                  <TableHead className="min-w-32">Prioridade</TableHead>
                  <TableHead className="min-w-32">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => {
                  const { fields, messages } = errorsByRow.get(row.rowNumber) ?? { fields: {}, messages: [] }
                  const hasError = messages.length > 0
                  return (
                    <TableRow
                      key={row.rowNumber}
                      className={hasError ? "bg-red-50/60 dark:bg-red-950/20" : "bg-emerald-50/60 dark:bg-emerald-950/20"}
                    >
                      <TableCell>
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              hasError ? (
                                <AlertCircle className="h-4 w-4 text-destructive" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                              )
                            }
                          />
                          <TooltipContent>
                            {hasError ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="font-medium">Esta linha não será importada:</span>
                                <ul className="list-disc pl-4">
                                  {messages.map((message, index) => (
                                    <li key={index}>{message}</li>
                                  ))}
                                </ul>
                              </div>
                            ) : (
                              "Pronta para importar"
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{row.sourceLabel}</TableCell>
                      <TableCell className={fields.date ? INVALID_CELL_CLASS : undefined} title={fields.date}>
                        <DatePicker
                          value={row.date}
                          onValueChange={(v) => updateRow(row.rowNumber, { date: v })}
                          aria-invalid={!!fields.date}
                          className="w-36"
                        />
                      </TableCell>
                      <TableCell className={fields.clientId ? INVALID_CELL_CLASS : undefined} title={fields.clientId}>
                        <div className="flex items-center gap-1">
                          <Combobox
                            items={clients}
                            value={row.clientId}
                            onValueChange={(v) => updateRow(row.rowNumber, { clientId: v })}
                            placeholder={row.clientHint || "Selecione..."}
                            aria-invalid={!!fields.clientId}
                            className="flex-1 min-w-0"
                          />
                          {renderFillDownButton("clientId", row)}
                        </div>
                      </TableCell>
                      <TableCell className={fields.analystId ? INVALID_CELL_CLASS : undefined} title={fields.analystId}>
                        <div className="flex items-center gap-1">
                          <Combobox
                            items={analysts}
                            value={row.analystId}
                            onValueChange={(v) => updateRow(row.rowNumber, { analystId: v })}
                            placeholder={row.analystHint || "Selecione..."}
                            aria-invalid={!!fields.analystId}
                            className="flex-1 min-w-0"
                          />
                          {renderFillDownButton("analystId", row)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Combobox
                            items={requesters}
                            value={row.requesterId}
                            onValueChange={(v) => updateRow(row.rowNumber, { requesterId: v })}
                            placeholder="Nenhum"
                            className="flex-1 min-w-0"
                          />
                          {renderFillDownButton("requesterId", row)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Combobox
                            items={departments}
                            value={row.departmentId}
                            onValueChange={(v) => updateRow(row.rowNumber, { departmentId: v })}
                            placeholder="Nenhum"
                            className="flex-1 min-w-0"
                          />
                          {renderFillDownButton("departmentId", row)}
                        </div>
                      </TableCell>
                      <TableCell className={fields.name ? INVALID_CELL_CLASS : undefined} title={fields.name}>
                        <Input
                          value={row.name}
                          onChange={(e) => updateRow(row.rowNumber, { name: e.target.value })}
                          className="min-w-56"
                          aria-invalid={!!fields.name}
                        />
                      </TableCell>
                      <TableCell className={fields.description ? INVALID_CELL_CLASS : undefined} title={fields.description}>
                        <Input
                          value={row.description}
                          onChange={(e) => updateRow(row.rowNumber, { description: e.target.value })}
                          className="min-w-56"
                          aria-invalid={!!fields.description}
                        />
                      </TableCell>
                      <TableCell className={fields.hours ? INVALID_CELL_CLASS : undefined} title={fields.hours}>
                        <Input
                          type="text"
                          inputMode="decimal"
                          value={row.hours}
                          onChange={(e) => updateRow(row.rowNumber, { hours: e.target.value })}
                          className="w-20"
                          aria-invalid={!!fields.hours}
                        />
                      </TableCell>
                      <TableCell className={fields.demandTypeId ? INVALID_CELL_CLASS : undefined} title={fields.demandTypeId}>
                        <div className="flex items-center gap-1">
                          <Combobox
                            items={demandTypes}
                            value={row.demandTypeId}
                            onValueChange={(v) => updateRow(row.rowNumber, { demandTypeId: v })}
                            placeholder="Selecione..."
                            aria-invalid={!!fields.demandTypeId}
                            className="flex-1 min-w-0"
                          />
                          {renderFillDownButton("demandTypeId", row)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Select
                            items={PRIORITY_OPTIONS}
                            value={row.priority}
                            onValueChange={(v) => updateRow(row.rowNumber, { priority: v || row.priority })}
                          >
                            <SelectTrigger className="flex-1 min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PRIORITY_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {renderFillDownButton("priority", row)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Select
                            items={STATUS_OPTIONS}
                            value={row.status}
                            onValueChange={(v) => updateRow(row.rowNumber, { status: v || row.status })}
                          >
                            <SelectTrigger className="flex-1 min-w-0">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o.value} value={o.value}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {renderFillDownButton("status", row)}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </DialogBody>
          <DialogFooter className="items-center sm:justify-between">
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {hasBlockingErrors && <AlertTriangle className="h-4 w-4 text-amber-500" />}
              {readyCount} de {rows.length} linha(s) prontas para importar
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={submitting || hasBlockingErrors}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirmar Importação
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={!!fillDownRequest}
        onOpenChange={(next) => !next && setFillDownRequest(null)}
        title="Aplicar valor às linhas abaixo"
        description={
          fillDownRequest
            ? `Deseja aplicar o valor "${fillDownRequest.label}" à coluna ${FILL_DOWN_COLUMN_LABELS[fillDownRequest.field]} em todas as linhas abaixo desta? Somente esta coluna será alterada.${
                search.trim() ? " Linhas ocultas pelo filtro de busca não serão alteradas." : ""
              }`
            : ""
        }
        confirmLabel="Aplicar"
        onConfirm={applyFillDown}
      />
    </>
  )
}
