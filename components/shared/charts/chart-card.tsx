"use client"

import dynamic from "next/dynamic"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { PendingRegion } from "@/components/shared/pending-region"
import { ChartTypeSelect } from "@/components/shared/charts/chart-type-select"
import type { MultiTypeChartProps } from "@/components/shared/charts/multi-type-chart"
import type { ChartKind, ChartSeries } from "@/components/shared/charts/chart-types"

// recharts is only needed once a chart tab is opened — the default "Visão Geral" tab has none.
const MultiTypeChart = dynamic<MultiTypeChartProps>(
  () => import("@/components/shared/charts/multi-type-chart").then((m) => m.MultiTypeChart),
  { ssr: false, loading: () => <Skeleton className="h-[260px] w-full" /> }
)

export interface ChartCardProps {
  title: string
  data: Record<string, string | number>[]
  nameKey: string
  series: ChartSeries[]
  kind: ChartKind
  onKindChange: (kind: ChartKind) => void
  allowedKinds?: ChartKind[]
  colorByIndex?: boolean
  statusColorMap?: Record<string, string>
  colorKey?: string
  measure?: string
  onMeasureChange?: (key: string) => void
  emptyMessage?: string
  height?: number
  valueFormatter?: (value: number) => string
  /** Data depends on the selected period and a new one is loading. */
  pending?: boolean
}

export function ChartCard({
  title,
  data,
  nameKey,
  series,
  kind,
  onKindChange,
  allowedKinds,
  colorByIndex,
  statusColorMap,
  colorKey,
  measure,
  onMeasureChange,
  emptyMessage,
  height,
  valueFormatter,
  pending = false,
}: ChartCardProps) {
  return (
    <PendingRegion pending={pending}>
      <Card className="h-full">
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
          <CardTitle className="min-w-0 text-sm">{title}</CardTitle>
          <ChartTypeSelect
            value={kind}
            onChange={onKindChange}
            allowedKinds={allowedKinds}
            series={series}
            measure={measure}
            onMeasureChange={onMeasureChange}
          />
        </CardHeader>
        <CardContent>
          <MultiTypeChart
            data={data}
            nameKey={nameKey}
            series={series}
            kind={kind}
            colorByIndex={colorByIndex}
            statusColorMap={statusColorMap}
            colorKey={colorKey}
            pieSeriesKey={measure}
            emptyMessage={emptyMessage}
            height={height ?? 260}
            valueFormatter={valueFormatter}
          />
        </CardContent>
      </Card>
    </PendingRegion>
  )
}
