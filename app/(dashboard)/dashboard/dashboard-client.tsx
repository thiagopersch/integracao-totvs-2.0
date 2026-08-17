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
import { formatDate, formatDuration } from "@/utils/format"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

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
}

export function DashboardClient({ stats, recentLogs, chartData }: DashboardClientProps) {
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
            <div className="text-2xl font-bold text-green-600">{successRate}%</div>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Falhas Hoje</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.failedToday}</div>
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
              {chartData.length > 0 ? Math.round(chartData.reduce((a, b) => a + b.calls, 0) / chartData.length) : 0}/dia
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" className="text-xs" />
                  <YAxis className="text-xs" allowDecimals={false} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="calls"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))" }}
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
    </div>
  )
}
