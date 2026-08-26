"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Building2,
  Server,
  Users,
  Radio,
  AlertTriangle,
  Clock,
  Activity,
  BarChart3,
} from "lucide-react"
import { formatDate, formatDuration, formatNumber } from "@/utils/format"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts"

/** Fixed categorical order (blue, orange, aqua, yellow, magenta, green, violet, red) — never reassigned by rank. */
const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
]

const DEMAND_STATUS_COLORS: Record<string, string> = {
  Pendente: "var(--chart-warning)",
  "Em Andamento": "var(--chart-1)",
  Concluída: "var(--chart-good)",
  Cancelada: "var(--chart-critical)",
}

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
}

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 }

interface NamedValue {
  name: string
  value: number
}

/** Single-measure bar chart (magnitude, not identity) — every bar shares one hue unless `colorByIndex` asks for the fixed categorical order. */
function CategoryBarChart({
  data,
  color,
  colorByIndex = false,
  emptyMessage = "Nenhum dado disponível",
}: {
  data: NamedValue[]
  color?: string
  colorByIndex?: boolean
  emptyMessage?: string
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-muted-foreground">{emptyMessage}</div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
        <XAxis type="number" tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTick}
          width={110}
          axisLine={false}
          tickLine={false}
          tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 16)}…` : value)}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => formatNumber(Number(value))}
          cursor={{ fill: "var(--muted)" }}
        />
        <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={22}>
          {data.map((entry, index) => (
            <Cell
              key={entry.name}
              fill={colorByIndex ? CATEGORY_COLORS[index % CATEGORY_COLORS.length] : DEMAND_STATUS_COLORS[entry.name] || color || "var(--chart-1)"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
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
  tbcStatusData: NamedValue[]
  filterStatusData: NamedValue[]
  sentencesByCategory: NamedValue[]
  demandsByStatus: NamedValue[]
  demandsByAnalyst: NamedValue[]
  demandsByClient: NamedValue[]
  clientHoursRanking: Array<{ name: string; contratadas: number; gastas: number }>
}

export function DashboardClient({
  stats,
  recentLogs,
  chartData,
  tbcStatusData,
  filterStatusData,
  sentencesByCategory,
  demandsByStatus,
  demandsByAnalyst,
  demandsByClient,
  clientHoursRanking,
}: DashboardClientProps) {
  const successRate = stats.todaySoapCalls > 0
    ? Math.round(((stats.todaySoapCalls - stats.failedToday) / stats.todaySoapCalls) * 100)
    : 100

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Monitoramento do sistema de integração TOTVS RM</p>
      </div>

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
            <CardTitle className="text-sm font-medium">Integrações Hoje</CardTitle>
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
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Falhas Hoje</CardTitle>
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
            <p className="text-xs text-muted-foreground">Média últimos 7 dias</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Integrações - Últimos 7 Dias</CardTitle>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} />
                  <YAxis tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value) => [formatNumber(Number(value)), "Chamadas"]}
                    labelFormatter={(label) => `Dia ${label}`}
                  />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    name="Chamadas"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ fill: "var(--chart-1)" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                Nenhum dado disponível
              </div>
            )}
          </CardContent>
        </Card>

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

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">TBCs por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={tbcStatusData} colorByIndex emptyMessage="Nenhum TBC cadastrado" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Filtros por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={filterStatusData} colorByIndex emptyMessage="Nenhum filtro cadastrado" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sentenças Padrões por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={sentencesByCategory} colorByIndex emptyMessage="Nenhuma sentença cadastrada" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Demandas por Status</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={demandsByStatus} colorByIndex emptyMessage="Nenhuma demanda cadastrada" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Demandas por Analista</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={demandsByAnalyst} color="var(--chart-1)" emptyMessage="Nenhuma demanda atribuída" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Demandas por Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart data={demandsByClient} color="var(--chart-2)" emptyMessage="Nenhuma demanda registrada" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Ranking de Clientes — Horas Gastas x Horas Contratadas</CardTitle>
        </CardHeader>
        <CardContent>
          {clientHoursRanking.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
              Nenhum contrato ou demanda registrada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={clientHoursRanking} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={false} />
                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={axisTick}
                  width={110}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: string) => (value.length > 16 ? `${value.slice(0, 16)}…` : value)}
                />
                <Tooltip contentStyle={tooltipStyle} formatter={(value) => `${formatNumber(Number(value))}h`} />
                <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                <Bar dataKey="contratadas" name="Horas contratadas" fill="var(--chart-1)" radius={[0, 4, 4, 0]} maxBarSize={16} />
                <Bar dataKey="gastas" name="Horas gastas" fill="var(--chart-2)" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
