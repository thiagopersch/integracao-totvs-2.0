"use client"

import { useMemo, useState } from "react"
import { AlertCircle, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Combobox, type ComboboxItem } from "@/components/ui/combobox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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

interface EditableRow {
  rowNumber: number
  date: string // yyyy-mm-dd, for <input type="date">
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

function rowErrors(row: EditableRow): string[] {
  const errors: string[] = []
  if (!row.date) errors.push("Data inválida")
  const hours = parseFloat(row.hours.replace(",", "."))
  if (!row.hours || Number.isNaN(hours) || hours <= 0) errors.push("Horas inválidas")
  if (!row.name.trim()) errors.push("Nome é obrigatório")
  if (!row.description.trim()) errors.push("Descrição é obrigatória")
  if (!row.clientId) errors.push("Cliente não identificado")
  if (!row.analystId) errors.push("Analista não identificado")
  if (!row.demandTypeId) errors.push("Tipo de demanda não identificado")
  return errors
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

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setRows(parsedRows.map(initialRow))
      setServerRowErrors({})
    }
  }

  function updateRow(rowNumber: number, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.rowNumber === rowNumber ? { ...r, ...patch } : r)))
  }

  const errorsByRow = useMemo(() => {
    const map = new Map<number, string[]>()
    for (const row of rows) {
      const errors = rowErrors(row)
      const serverError = serverRowErrors[row.rowNumber]
      if (serverError) errors.push(serverError)
      map.set(row.rowNumber, errors)
    }
    return map
  }, [rows, serverRowErrors])

  const readyCount = rows.filter((r) => (errorsByRow.get(r.rowNumber) ?? []).length === 0).length
  const hasBlockingErrors = readyCount < rows.length

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

      toast.success(`${result.createdCount} demanda(s) importada(s) com sucesso`)
      onOpenChange(false)
      onImported()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>Revisar importação — {fileName}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
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
              {rows.map((row) => {
                const errors = errorsByRow.get(row.rowNumber) ?? []
                const hasError = errors.length > 0
                return (
                  <TableRow key={row.rowNumber} className={hasError ? "bg-destructive/5" : undefined}>
                    <TableCell title={hasError ? errors.join("; ") : "Pronta para importar"}>
                      {hasError ? (
                        <AlertCircle className="h-4 w-4 text-destructive" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateRow(row.rowNumber, { date: e.target.value })}
                        className="w-36"
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        items={clients}
                        value={row.clientId}
                        onValueChange={(v) => updateRow(row.rowNumber, { clientId: v })}
                        placeholder={row.clientHint || "Selecione..."}
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        items={analysts}
                        value={row.analystId}
                        onValueChange={(v) => updateRow(row.rowNumber, { analystId: v })}
                        placeholder={row.analystHint || "Selecione..."}
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        items={requesters}
                        value={row.requesterId}
                        onValueChange={(v) => updateRow(row.rowNumber, { requesterId: v })}
                        placeholder="Nenhum"
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        items={departments}
                        value={row.departmentId}
                        onValueChange={(v) => updateRow(row.rowNumber, { departmentId: v })}
                        placeholder="Nenhum"
                      />
                    </TableCell>
                    <TableCell>
                      <Input value={row.name} onChange={(e) => updateRow(row.rowNumber, { name: e.target.value })} className="min-w-56" />
                    </TableCell>
                    <TableCell>
                      <Input
                        value={row.description}
                        onChange={(e) => updateRow(row.rowNumber, { description: e.target.value })}
                        className="min-w-56"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.hours}
                        onChange={(e) => updateRow(row.rowNumber, { hours: e.target.value })}
                        className="w-20"
                      />
                    </TableCell>
                    <TableCell>
                      <Combobox
                        items={demandTypes}
                        value={row.demandTypeId}
                        onValueChange={(v) => updateRow(row.rowNumber, { demandTypeId: v })}
                        placeholder="Selecione..."
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        items={PRIORITY_OPTIONS}
                        value={row.priority}
                        onValueChange={(v) => updateRow(row.rowNumber, { priority: v || row.priority })}
                      >
                        <SelectTrigger className="w-full">
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
                    </TableCell>
                    <TableCell>
                      <Select
                        items={STATUS_OPTIONS}
                        value={row.status}
                        onValueChange={(v) => updateRow(row.rowNumber, { status: v || row.status })}
                      >
                        <SelectTrigger className="w-full">
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
  )
}
