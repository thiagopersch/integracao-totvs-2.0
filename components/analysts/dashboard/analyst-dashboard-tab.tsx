"use client"

import { useState } from "react"
import { ChartCard } from "@/components/shared/charts/chart-card"
import type { ChartKind, ChartSeries } from "@/components/shared/charts/chart-types"
import { ColorBadge } from "@/components/shared/color-badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatCurrency, formatNumber } from "@/utils/format"
import type { AnalystUsageRow } from "@/services/analyst-dashboard.service"

const HOURS_SERIES: ChartSeries[] = [
  { key: "normal", name: "Horas normais", color: "var(--chart-1)" },
  { key: "excedente", name: "Horas excedentes", color: "var(--chart-critical)", fixedColor: true },
]
const VALUE_SERIES: ChartSeries[] = [
  { key: "valorNormal", name: "Valor normal (R$)", color: "var(--chart-2)" },
  { key: "valorExcedente", name: "Valor excedente (R$)", color: "var(--chart-critical)", fixedColor: true },
]

interface AnalystDashboardTabProps {
  data: AnalystUsageRow[]
  periodLabel: string
  pending?: boolean
}

export function AnalystDashboardTab({ data, periodLabel, pending }: AnalystDashboardTabProps) {
  const [hoursKind, setHoursKind] = useState<ChartKind>("bar-v")
  const [valueKind, setValueKind] = useState<ChartKind>("bar-v")

  const hoursByContract = data.flatMap((analyst) =>
    analyst.contracts.map((c) => ({
      name: `${analyst.analystName} — ${c.clientName}`,
      normal: c.hoursNormal,
      excedente: c.hoursExcess,
      color: c.clientColor,
    }))
  )
  const valueByContract = data.flatMap((analyst) =>
    analyst.contracts.map((c) => ({
      name: `${analyst.analystName} — ${c.clientName}`,
      valorNormal: c.valueNormal,
      valorExcedente: c.valueExcess,
      color: c.clientColor,
    }))
  )

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title={`Horas normais x excedentes por contrato (${periodLabel})`}
          data={hoursByContract}
          nameKey="name"
          series={HOURS_SERIES}
          kind={hoursKind}
          onKindChange={setHoursKind}
          colorKey="color"
          valueFormatter={(v) => `${formatNumber(v)}h`}
          emptyMessage="Nenhum contrato com analistas vinculados no período."
          pending={pending}
        />
        <ChartCard
          title={`Valor normal x excedente por contrato (${periodLabel})`}
          data={valueByContract}
          nameKey="name"
          series={VALUE_SERIES}
          kind={valueKind}
          onKindChange={setValueKind}
          colorKey="color"
          valueFormatter={(v) => formatCurrency(v)}
          emptyMessage="Nenhum contrato com analistas vinculados no período."
          pending={pending}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Detalhe por analista e contrato — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contrato com analistas vinculados no período.</p>
          )}
          {data.map((analyst) => (
            <div key={analyst.analystId} className="space-y-2 rounded-xl border p-3">
              <ColorBadge label={analyst.analystName} color={analyst.analystColor} solid />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium">Contrato</th>
                      <th className="text-right font-medium">Horas normais</th>
                      <th className="text-right font-medium">Horas excedentes</th>
                      <th className="text-right font-medium">Valor normal</th>
                      <th className="text-right font-medium">Valor excedente</th>
                      <th className="text-right font-medium">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analyst.contracts.map((c) => (
                      <tr key={c.contractId} className="border-t">
                        <td className="py-1">
                          <ColorBadge label={c.clientName} color={c.clientColor} />
                        </td>
                        <td className="text-right tabular-nums">{formatNumber(c.hoursNormal)}h</td>
                        <td className="text-right tabular-nums">{formatNumber(c.hoursExcess)}h</td>
                        <td className="text-right tabular-nums">{formatCurrency(c.valueNormal)}</td>
                        <td className="text-right tabular-nums">{formatCurrency(c.valueExcess)}</td>
                        <td className="text-right font-medium tabular-nums">{formatCurrency(c.valueTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t font-medium">
                      <td className="py-1">Total</td>
                      <td className="text-right tabular-nums">{formatNumber(analyst.totals.hoursNormal)}h</td>
                      <td className="text-right tabular-nums">{formatNumber(analyst.totals.hoursExcess)}h</td>
                      <td className="text-right tabular-nums">{formatCurrency(analyst.totals.valueNormal)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(analyst.totals.valueExcess)}</td>
                      <td className="text-right tabular-nums">{formatCurrency(analyst.totals.valueTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
