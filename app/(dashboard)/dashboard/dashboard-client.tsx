"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Building2,
  Server,
  Users,
  Radio,
  AlertTriangle,
  Clock,
  Activity,
  BarChart3,
  FileClock,
} from "lucide-react"
import { formatDate, formatDuration, formatNumber } from "@/utils/format"
import { MultiTypeChart } from "@/components/shared/charts/multi-type-chart"
import { ChartTypeSelect } from "@/components/shared/charts/chart-type-select"
import type { ChartKind, ChartSeries } from "@/components/shared/charts/chart-types"
import { PeriodSelect } from "@/components/shared/period-select"
import { usePeriodFilter } from "@/hooks/use-period-filter"
import type { Period } from "@/lib/period"
import { ColorBadge } from "@/components/shared/color-badge"
import { ContractUsageBar } from "@/components/shared/contract-usage-bar"
import { USAGE_LEVEL_COLORS, USAGE_LEVEL_LABELS, USAGE_TONE_CLASSES, usageTone, type UsageLevel } from "@/lib/contract-usage"
import { cn } from "@/lib/utils"

type NamedValue = {
  name: string
  value: number
}

interface ChartCardProps {
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
}

function ChartCard({
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
}: ChartCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-sm">{title}</CardTitle>
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
  )
}

interface DashboardClientProps {
  stats: {
    totalClients: number
    totalTbcs: number
    totalUsers: number
    todaySoapCalls: number
    failedToday: number
    avgDuration: number
    clientCount: number
  }
  recentLogs: Array<{
    id: string
    dataserver: string | null
    process: string | null
    method: string | null
    status: number | null
    duration: number | null
    error: string | null
    createdAt: Date
    user?: { name: string } | null
  }>
  chartData: Array<{ date: string; calls: number }>
  clientStatusData: NamedValue[]
  tbcStatusData: NamedValue[]
  filterStatusData: NamedValue[]
  sentencesByCategory: NamedValue[]
  demandsByStatus: Array<NamedValue & { color: string }>
  demandsByPriority: Array<NamedValue & { color: string }>
  demandsByType: Array<NamedValue & { color: string }>
  demandsByTag: Array<NamedValue & { color: string }>
  demandsByAnalyst: NamedValue[]
  demandsByClient: Array<NamedValue & { color: string }>
  clientHoursRanking: Array<{ name: string; contratadas: number; gastas: number; color: string }>
  contractsUsage: Array<{
    clientId: string
    clientName: string
    clientColor: string
    usedHours: number
    contractedHours: number
    percent: number
    level: UsageLevel
  }>
  contractsUsageMonthLabel: string
  period: Period | null
  years: number[]
  monthsByYear: Record<number, number[]>
}

const VALUE_SERIES: ChartSeries[] = [{ key: "value", name: "Quantidade" }]
const RANKING_SERIES: ChartSeries[] = [
  { key: "contratadas", name: "Horas contratadas", color: "var(--chart-1)" },
  { key: "gastas", name: "Horas gastas", color: "var(--chart-2)" },
]

export function DashboardClient({
  stats,
  recentLogs,
  chartData,
  clientStatusData,
  tbcStatusData,
  filterStatusData,
  sentencesByCategory,
  demandsByStatus,
  demandsByPriority,
  demandsByType,
  demandsByTag,
  demandsByAnalyst,
  demandsByClient,
  clientHoursRanking,
  contractsUsage,
  contractsUsageMonthLabel,
  period: initialPeriod,
  years,
  monthsByYear,
}: DashboardClientProps) {
  const { period, setPeriod } = usePeriodFilter(initialPeriod)

  const [integrationsKind, setIntegrationsKind] = useState<ChartKind>("line")
  const [clientStatusKind, setClientStatusKind] = useState<ChartKind>("pie")
  const [tbcStatusKind, setTbcStatusKind] = useState<ChartKind>("pie")
  const [filterStatusKind, setFilterStatusKind] = useState<ChartKind>("pie")
  const [sentencesKind, setSentencesKind] = useState<ChartKind>("pie")
  const [demandsStatusKind, setDemandsStatusKind] = useState<ChartKind>("pie")
  const [demandsPriorityKind, setDemandsPriorityKind] = useState<ChartKind>("donut")
  const [demandsTypeKind, setDemandsTypeKind] = useState<ChartKind>("pie")
  const [demandsTagKind, setDemandsTagKind] = useState<ChartKind>("pie")
  const [demandsAnalystKind, setDemandsAnalystKind] = useState<ChartKind>("donut")
  const [demandsClientKind, setDemandsClientKind] = useState<ChartKind>("bar-h")
  const [rankingKind, setRankingKind] = useState<ChartKind>("bar-h")
  const [rankingMeasure, setRankingMeasure] = useState<string>("gastas")

  const successRate = stats.todaySoapCalls > 0
    ? Math.round(((stats.todaySoapCalls - stats.failedToday) / stats.todaySoapCalls) * 100)
    : 100

  const analystSeries: ChartSeries[] = [{ key: "value", name: "Quantidade", color: "var(--chart-1)" }]
  const clientSeries: ChartSeries[] = [{ key: "value", name: "Quantidade", color: "var(--chart-2)" }]

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Monitoramento do sistema de integração TOTVS RM</p>
        </div>
        <PeriodSelect years={years} monthsByYear={monthsByYear} value={period} onChange={setPeriod} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="integrations">Integrações</TabsTrigger>
          <TabsTrigger value="clients">Clientes/TBCs/Filtros</TabsTrigger>
          <TabsTrigger value="demands">Demandas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Clientes Ativos</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalClients}</div>
                <p className="text-xs text-muted-foreground">Total: {stats.clientCount}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">TBCs Ativos</CardTitle>
                <Server className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalTbcs}</div>
                <p className="text-xs text-muted-foreground">Conexões configuradas</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalUsers}</div>
                <p className="text-xs text-muted-foreground">Cadastrados no sistema</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Integrações {period ? "no Período" : "Hoje"}</CardTitle>
                <Radio className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.todaySoapCalls}</div>
                <p className="text-xs text-muted-foreground">Chamadas SOAP</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: "var(--chart-good)" }}>{successRate}%</div>
                <p className="text-xs text-muted-foreground">{period ? "No período" : "Últimas 24h"}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Falhas {period ? "no Período" : "Hoje"}</CardTitle>
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: "var(--chart-critical)" }}>{stats.failedToday}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.failedToday > 0 ? "Revisar integrações" : "Nenhuma falha"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatDuration(stats.avgDuration)}</div>
                <p className="text-xs text-muted-foreground">Resposta SOAP</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(chartData.length > 0 ? chartData.reduce((a, b) => a + b.calls, 0) / chartData.length : 0)}/dia
                </div>
                <p className="text-xs text-muted-foreground">Média {period ? "no período" : "últimos 7 dias"}</p>
              </CardContent>
            </Card>
          </div>

          <Card className="mt-4">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">Consumo dos Contratos — {contractsUsageMonthLabel}</CardTitle>
                <p className="text-xs text-muted-foreground">Contratos vinculados a você, do maior para o menor consumo</p>
              </div>
              <div className="flex items-center gap-2">
                {contractsUsage.length > 0 && (
                  <Badge variant="outline">
                    {contractsUsage.length}
                  </Badge>
                )}
                <FileClock className="h-4 w-4 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              {contractsUsage.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">Nenhum contrato vigente vinculado</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {contractsUsage.map((c) => (
                    <Link
                      key={c.clientId}
                      href="/contracts"
                      className={cn(
                        "flex flex-col gap-2 rounded-lg border p-3 transition-opacity hover:opacity-80",
                        USAGE_TONE_CLASSES[usageTone(c.percent)]
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <ColorBadge label={c.clientName} color={c.clientColor} solid />
                        <ColorBadge label={USAGE_LEVEL_LABELS[c.level]} color={USAGE_LEVEL_COLORS[c.level]} />
                      </div>
                      <ContractUsageBar
                        usedHours={c.usedHours}
                        contractedHours={c.contractedHours}
                        percent={c.percent}
                        level={c.level}
                      />
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="integrations" className="pt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title={`Integrações - ${period ? "Período Selecionado" : "Últimos 7 Dias"}`}
              data={chartData}
              nameKey="date"
              series={[{ key: "calls", name: "Chamadas", color: "var(--chart-1)" }]}
              kind={integrationsKind}
              onKindChange={setIntegrationsKind}
              allowedKinds={["line", "bar-v", "bar-h"]}
              emptyMessage="Nenhum dado disponível"
              height={300}
              valueFormatter={formatNumber}
            />

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Últimas Execuções SOAP</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  {recentLogs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">Nenhuma execução recente</p>
                  ) : (
                    <div className="space-y-3">
                      {recentLogs.map((log) => (
                        <div key={log.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">
                              {log.dataserver}/{log.process}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {log.method} • {log.user?.name || "Sistema"} • {formatDate(log.createdAt)}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-2">
                            {log.duration && (
                              <span className="text-xs text-muted-foreground">{formatDuration(log.duration)}</span>
                            )}
                            <Badge variant={log.error ? "destructive" : log.status && log.status < 400 ? "default" : "secondary"}>
                              {log.error ? "Erro" : log.status || "OK"}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clients" className="pt-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <ChartCard
              title="Clientes por Status"
              data={clientStatusData}
              nameKey="name"
              series={VALUE_SERIES}
              kind={clientStatusKind}
              onKindChange={setClientStatusKind}
              colorByIndex
              emptyMessage="Nenhum cliente cadastrado"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="TBCs por Status"
              data={tbcStatusData}
              nameKey="name"
              series={VALUE_SERIES}
              kind={tbcStatusKind}
              onKindChange={setTbcStatusKind}
              colorByIndex
              emptyMessage="Nenhum TBC cadastrado"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Filtros por Status"
              data={filterStatusData}
              nameKey="name"
              series={VALUE_SERIES}
              kind={filterStatusKind}
              onKindChange={setFilterStatusKind}
              colorByIndex
              emptyMessage="Nenhum filtro cadastrado"
              valueFormatter={formatNumber}
            />
          </div>
        </TabsContent>

        <TabsContent value="demands" className="pt-4 space-y-4">
          <ChartCard
            title="Ranking de Clientes — Horas Gastas x Horas Contratadas"
            data={clientHoursRanking}
            nameKey="name"
            series={RANKING_SERIES}
            kind={rankingKind}
            onKindChange={setRankingKind}
            colorKey="color"
            measure={rankingMeasure}
            onMeasureChange={setRankingMeasure}
            emptyMessage="Nenhum contrato ou demanda registrada"
            height={300}
            valueFormatter={(v) => `${formatNumber(v)}h`}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <ChartCard
              title="Demandas por Status"
              data={demandsByStatus}
              nameKey="name"
              series={VALUE_SERIES}
              kind={demandsStatusKind}
              onKindChange={setDemandsStatusKind}
              colorKey="color"
              emptyMessage="Nenhuma demanda cadastrada"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Demandas por Prioridade"
              data={demandsByPriority}
              nameKey="name"
              series={VALUE_SERIES}
              kind={demandsPriorityKind}
              onKindChange={setDemandsPriorityKind}
              colorKey="color"
              emptyMessage="Nenhuma demanda registrada"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Demandas por Tipo"
              data={demandsByType}
              nameKey="name"
              series={VALUE_SERIES}
              kind={demandsTypeKind}
              onKindChange={setDemandsTypeKind}
              colorKey="color"
              emptyMessage="Nenhuma demanda registrada"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Demandas por Tag"
              data={demandsByTag}
              nameKey="name"
              series={VALUE_SERIES}
              kind={demandsTagKind}
              onKindChange={setDemandsTagKind}
              colorKey="color"
              emptyMessage="Nenhuma demanda com tags"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Demandas por Analista"
              data={demandsByAnalyst}
              nameKey="name"
              series={analystSeries}
              kind={demandsAnalystKind}
              onKindChange={setDemandsAnalystKind}
              emptyMessage="Nenhuma demanda atribuída"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Demandas por Cliente"
              data={demandsByClient}
              nameKey="name"
              series={clientSeries}
              kind={demandsClientKind}
              onKindChange={setDemandsClientKind}
              colorKey="color"
              emptyMessage="Nenhuma demanda registrada"
              valueFormatter={formatNumber}
            />
            <ChartCard
              title="Sentenças Padrões por Categoria"
              data={sentencesByCategory}
              nameKey="name"
              series={VALUE_SERIES}
              kind={sentencesKind}
              onKindChange={setSentencesKind}
              colorByIndex
              emptyMessage="Nenhuma sentença cadastrada"
              valueFormatter={formatNumber}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
