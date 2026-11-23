"use client"

import { DataTable } from "@/components/shared/data-table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { summarize, toChecklistRows } from "@/lib/ps-compare/compare"
import { STATUS_LABELS } from "@/lib/ps-compare/labels"
import type { ChecklistRow, CompareResult, CompareStatus } from "@/lib/ps-compare/types"
import { downloadBlob, slugify } from "@/lib/ps-docs/download-utils"
import { toast } from "@/lib/toast"
import type { ColumnDef } from "@tanstack/react-table"
import { FileSpreadsheet } from "lucide-react"
import { useMemo, useState } from "react"
import { CompareTree } from "./compare-tree"
import { StatusBadge, StatusIcon } from "./status-badge"

const STATUSES: CompareStatus[] = ["diferente", "so_a", "so_b", "igual"]
const dash = (v: string) => v || "—"

function Truncated({ value }: { value: string }) {
  return (
    <span className="block truncate" title={value.length > 60 ? value : undefined}>
      {dash(value)}
    </span>
  )
}

export function CompareResultView({ result }: { result: CompareResult }) {
  const summary = useMemo(() => summarize(result), [result])
  const allRows = useMemo(() => toChecklistRows(result), [result])
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [statusFilter, setStatusFilter] = useState("")
  const [tipoFilter, setTipoFilter] = useState("")
  const [showEqual, setShowEqual] = useState(false)
  const [selected, setSelected] = useState<ChecklistRow | null>(null)

  const tipos = useMemo(() => [...new Set(allRows.map((r) => r.tipo))].sort((a, b) => a.localeCompare(b, "pt-BR")), [allRows])
  const rows = useMemo(
    () =>
      allRows.filter(
        (r) => (showEqual || r.status !== "igual" || statusFilter === "igual") && (!statusFilter || r.status === statusFilter) && (!tipoFilter || r.tipo === tipoFilter)
      ),
    [allRows, showEqual, statusFilter, tipoFilter]
  )
  const pendingRows = allRows.filter((r) => r.status !== "igual")
  const doneCount = pendingRows.filter((r) => checked.has(r.id)).length

  const toggle = (id: string, value: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })

  const columns = useMemo<ColumnDef<ChecklistRow>[]>(
    () => [
      {
        id: "ajustado",
        accessorFn: (r) => (checked.has(r.id) ? 1 : 0),
        header: "Ajustado",
        meta: { width: 100, align: "center", exportValue: (r) => (checked.has(r.id) ? "Sim" : "Não") },
        cell: ({ row }) =>
          row.original.status === "igual" ? null : (
            <Checkbox checked={checked.has(row.original.id)} onCheckedChange={(v) => toggle(row.original.id, v)} aria-label="Marcar como ajustado" />
          ),
      },
      {
        id: "status",
        accessorFn: (r) => STATUS_LABELS[r.status],
        header: "Status",
        meta: { width: 120, exportValue: (r) => STATUS_LABELS[r.status] },
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
      },
      { accessorKey: "tipo", header: "Tipo", meta: { width: 120 } },
      { accessorKey: "caminho", header: "Caminho", meta: { minWidth: 260 }, cell: ({ row }) => <Truncated value={row.original.caminho} /> },
      { accessorKey: "propriedade", header: "Propriedade", meta: { minWidth: 200 }, cell: ({ row }) => <Truncated value={row.original.propriedade} /> },
      { accessorKey: "valorA", header: "Valor em A", meta: { minWidth: 200 }, cell: ({ row }) => <Truncated value={row.original.valorA} /> },
      { accessorKey: "valorB", header: "Valor em B", meta: { minWidth: 200 }, cell: ({ row }) => <Truncated value={row.original.valorB} /> },
    ],
    [checked]
  )

  async function exportXlsx() {
    try {
      const XLSX = await import("xlsx")
      const resumo: (string | number)[][] = [
        ["", "PS A (referência)", "PS B (a ajustar)"],
        ["Portal", result.a.portal, result.b.portal],
        ["Processo seletivo", result.a.processo, result.b.processo],
        ["ID PS", result.a.idPs, result.b.idPs],
        [],
        ["Tipo", ...STATUSES.map((s) => STATUS_LABELS[s])],
        ...Object.entries(summary.porTipo).map(([tipo, c]) => [tipo, ...STATUSES.map((s) => c[s])]),
        ["Total", ...STATUSES.map((s) => summary[s])],
        [],
        ["Itens do checklist", pendingRows.length],
        ["Ajustados", doneCount],
      ]
      const header = ["Ajustado", "Status", "Tipo", "Caminho", "Elemento", "Propriedade", "Valor em A", "Valor em B"]
      const data = allRows.map((r) => [r.status === "igual" ? "-" : checked.has(r.id) ? "Sim" : "Não", STATUS_LABELS[r.status], r.tipo, r.caminho, r.elemento, r.propriedade, r.valorA, r.valorB])
      const sheet = XLSX.utils.aoa_to_sheet([header, ...data])
      sheet["!cols"] = header.map((h, i) => ({ wch: Math.min(70, Math.max(h.length, ...data.map((r) => String(r[i] ?? "").length)) + 2) }))
      if (sheet["!ref"]) sheet["!autofilter"] = { ref: sheet["!ref"] }
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(resumo), "Resumo")
      XLSX.utils.book_append_sheet(workbook, sheet, "Checklist")
      const out = XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as ArrayBuffer
      const name = `comparativo-${slugify(result.a.processo) || result.a.idPs}-x-${slugify(result.b.processo) || result.b.idPs}.xlsx`
      downloadBlob(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), name)
    } catch (e) {
      toast.error(`Falha ao exportar: ${(e as Error).message}`)
    }
  }

  const filterPanel = (
    <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
      <Field>
        <FieldLabel>Status</FieldLabel>
        <Select
          items={[{ value: "all", label: "Todos" }, ...STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field>
        <FieldLabel>Tipo de elemento</FieldLabel>
        <Select items={[{ value: "all", label: "Todos" }, ...tipos.map((t) => ({ value: t, label: t }))]} value={tipoFilter || "all"} onValueChange={(v) => setTipoFilter(!v || v === "all" ? "" : v)}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <label className="flex items-center gap-2 pb-2 text-sm">
        <Switch checked={showEqual} onCheckedChange={setShowEqual} /> Mostrar elementos iguais
      </label>
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Comparativo
          <span className="text-sm font-normal text-muted-foreground">
            A: {result.a.processo} ({result.a.idPs}) · B: {result.b.processo} ({result.b.idPs})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter((prev) => (prev === s ? "" : s))}
              className={`flex items-center gap-3 rounded-md border p-3 text-left transition-colors hover:bg-muted/50 ${statusFilter === s ? "border-primary bg-muted/50" : ""}`}
            >
              <StatusIcon status={s} className="size-5" />
              <div>
                <div className="text-2xl font-semibold tabular-nums">{summary[s]}</div>
                <div className="text-xs text-muted-foreground">{STATUS_LABELS[s]}</div>
              </div>
            </button>
          ))}
          <div className="flex flex-col justify-center rounded-md border p-3">
            <div className="text-2xl font-semibold tabular-nums">
              {doneCount}/{pendingRows.length}
            </div>
            <div className="text-xs text-muted-foreground">Ajustes marcados</div>
          </div>
        </div>

        <Tabs defaultValue="checklist">
          <TabsList>
            <TabsTrigger value="checklist">Checklist</TabsTrigger>
            <TabsTrigger value="estrutura">Estrutura</TabsTrigger>
          </TabsList>
          <TabsContent value="checklist" className="mt-4">
            <DataTable
              columns={columns}
              data={rows}
              searchPlaceholder="Filtrar por elemento, propriedade ou valor..."
              pageSize={25}
              filterPanel={filterPanel}
              onRowClick={setSelected}
              toolbarActions={
                <Button variant="outline" size="sm" className="h-9" onClick={exportXlsx} disabled={allRows.length === 0}>
                  <FileSpreadsheet className="size-4" /> Baixar Excel
                </Button>
              }
              emptyMessage={allRows.some((r) => r.status !== "igual") ? "Nenhum item para os filtros informados." : "Nenhuma diferença — os dois processos estão iguais."}
            />
          </TabsContent>
          <TabsContent value="estrutura" className="mt-4">
            <CompareTree nodes={result.etapas} onlyDifferences={!showEqual} />
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>{selected?.propriedade}</DialogTitle>
          </DialogHeader>
          {selected && (
            <DialogBody className="space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <StatusBadge status={selected.status} /> {selected.caminho}
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {(["valorA", "valorB"] as const).map((k) => (
                  <div key={k} className="rounded-md border p-3">
                    <div className="mb-1 text-xs font-medium text-muted-foreground uppercase">{k === "valorA" ? "PS A" : "PS B"}</div>
                    <div className="text-sm break-words whitespace-pre-wrap">{dash(selected[k])}</div>
                  </div>
                ))}
              </div>
              {selected.status !== "igual" && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={checked.has(selected.id)} onCheckedChange={(v) => toggle(selected.id, v)} /> Marcar como ajustado
                </label>
              )}
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}
