"use client"

import { ChartCard } from "@/components/shared/charts/chart-card"
import type { ChartSeries } from "@/components/shared/charts/chart-types"
import { ColorBadge } from "@/components/shared/color-badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
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
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum contrato com analistas vinculados no período.</p>
  }

  return (
    <Accordion multiple className="space-y-3">
      {data.map((analyst) => {
        const hoursByContract = analyst.contracts.map((c) => ({
          name: c.clientName,
          normal: c.hoursNormal,
          excedente: c.hoursExcess,
          color: c.clientColor,
        }))
        const valueByContract = analyst.contracts.map((c) => ({
          name: c.clientName,
          valorNormal: c.valueNormal,
          valorExcedente: c.valueExcess,
          color: c.clientColor,
        }))

        return (
          <AccordionItem key={analyst.analystId} value={analyst.analystId}>
            <AccordionTrigger>
              <div className="flex flex-1 flex-wrap items-center justify-between gap-2 pr-2">
                <ColorBadge label={analyst.analystName} color={analyst.analystColor} solid />
                <span className="text-xs text-muted-foreground">
                  {analyst.contracts.length} contrato(s) · {formatCurrency(analyst.totals.valueTotal)} ({periodLabel})
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
              <div className="grid gap-4 lg:grid-cols-2">
                <ChartCard
                  title={`Horas normais x excedentes por contrato (${periodLabel})`}
                  data={hoursByContract}
                  nameKey="name"
                  series={HOURS_SERIES}
                  kind="bar-v"
                  onKindChange={() => {}}
                  allowedKinds={["bar-v"]}
                  colorKey="color"
                  valueFormatter={(v) => `${formatNumber(v)}h`}
                  emptyMessage="Nenhum contrato no período."
                  pending={pending}
                />
                <ChartCard
                  title={`Valor normal x excedente por contrato (${periodLabel})`}
                  data={valueByContract}
                  nameKey="name"
                  series={VALUE_SERIES}
                  kind="bar-h"
                  onKindChange={() => {}}
                  allowedKinds={["bar-h"]}
                  colorKey="color"
                  valueFormatter={(v) => formatCurrency(v)}
                  emptyMessage="Nenhum contrato no período."
                  pending={pending}
                />
              </div>

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
            </AccordionContent>
          </AccordionItem>
        )
      })}
    </Accordion>
  )
}
