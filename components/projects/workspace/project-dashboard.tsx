"use client"

import { useState } from "react"
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { AlertTriangle, CheckCircle2, Clock, Diamond, Gauge, Wallet } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiTypeChart } from "@/components/shared/charts/multi-type-chart"
import { ContractUsageBar } from "@/components/shared/contract-usage-bar"
import { ProgressCell, StageBadge } from "@/components/projects/project-badges"
import { formatHours, taskKey } from "@/lib/projects"
import { formatDateOnly } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { ProjectDashboardData, WorkspaceActions } from "@/components/projects/workspace/types"

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
}
const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 }

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  hint?: React.ReactNode
  tone?: "danger" | "warning"
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", tone === "danger" && "text-destructive", tone === "warning" && "text-amber-500")} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold tabular-nums">{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function shortDate(key: string) {
  const [, m, d] = key.split("-")
  return `${d}/${m}`
}

export function ProjectDashboard({ data, projectCode, actions }: { data: ProjectDashboardData; projectCode: string; actions: WorkspaceActions }) {
  const [burnMode, setBurnMode] = useState<"down" | "up">("down")
  const { kpis } = data
  const unit = data.burn.unit === "hours" ? "h" : " tarefas"
  const fmtUnit = (v: number) => (data.burn.unit === "hours" ? formatHours(v) : `${v.toLocaleString("pt-BR")} tarefa(s)`)
  const gap = kpis.expectedProgress !== null ? kpis.expectedProgress - kpis.progress : null

  const stageData = data.stageCounts.filter((s) => s.count > 0).map((s) => ({ label: s.name, total: s.count }))
  const stageColorMap = Object.fromEntries(data.stageCounts.map((s) => [s.name, s.color]))
  const workloadData = data.workload.map((w) => ({ name: w.name, open: w.open, estimate: w.openEstimateHours, logged: w.loggedHours }))
  const weekData = data.hoursByWeek.map((w) => ({ week: shortDate(w.week), hours: w.hours }))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={Gauge}
          label="Progresso"
          value={`${Math.round(kpis.progress)}%`}
          hint={
            kpis.expectedProgress !== null ? (
              <span className={cn(gap !== null && gap > 10 && "text-destructive")}>
                Planejado para hoje: {kpis.expectedProgress}%{gap !== null && gap > 0 ? ` (${Math.round(gap)} p.p. abaixo)` : ""}
              </span>
            ) : (
              "Defina início e término previstos para comparar com o planejado"
            )
          }
        />
        <Kpi icon={CheckCircle2} label="Tarefas concluídas" value={`${kpis.done}/${kpis.total}`} hint={`${kpis.open} em aberto`} />
        <Kpi
          icon={AlertTriangle}
          label="Atrasadas"
          value={kpis.overdue}
          tone={kpis.overdue > 0 ? "danger" : undefined}
          hint={kpis.blocked > 0 ? `${kpis.blocked} bloqueada(s)` : "Nenhuma bloqueada"}
        />
        <Kpi
          icon={Diamond}
          label="Marcos"
          value={`${kpis.milestonesDone}/${kpis.milestonesTotal}`}
          hint={kpis.milestonesTotal ? "entregas-chave concluídas" : "Nenhum marco definido"}
        />
        <Kpi
          icon={Clock}
          label="Horas apontadas"
          value={formatHours(kpis.loggedHours)}
          tone={kpis.budgetHours && kpis.loggedHours > kpis.budgetHours ? "danger" : undefined}
          hint={
            <>
              {kpis.budgetHours ? `Orçamento: ${formatHours(kpis.budgetHours)}` : "Sem orçamento de horas"}
              {kpis.estimateHours ? ` · Estimado: ${formatHours(kpis.estimateHours)}` : ""}
            </>
          }
        />
        <Kpi
          icon={Wallet}
          label="Custo realizado"
          value={currency.format(kpis.cost)}
          tone={kpis.budgetAmount && kpis.cost > kpis.budgetAmount ? "danger" : undefined}
          hint={
            <>
              {kpis.budgetAmount ? `Orçamento: ${currency.format(kpis.budgetAmount)}` : "Sem orçamento financeiro"}
              {kpis.costCoveredHours < kpis.loggedHours ? ` · ${formatHours(kpis.loggedHours - kpis.costCoveredHours)} sem valor/hora` : ""}
            </>
          }
        />
        {data.usage && (
          <Card className="sm:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Contrato do cliente — mês atual</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ContractUsageBar {...data.usage} />
              <p className="text-xs text-muted-foreground">
                Avulsas {formatHours(data.usage.demandHours)} · Projetos {formatHours(data.usage.projectHours)}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm">{burnMode === "down" ? "Burndown — escopo restante" : "Burnup — concluído x escopo"}</CardTitle>
            <Tabs value={burnMode} onValueChange={(v) => setBurnMode(v as "down" | "up")}>
              <TabsList>
                <TabsTrigger value="down">Burndown</TabsTrigger>
                <TabsTrigger value="up">Burnup</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
            {data.burn.points.length === 0 ? (
              <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">Sem tarefas para medir.</div>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={data.burn.points} margin={{ left: 8, right: 16, top: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="date" tick={axisTick} tickFormatter={shortDate} axisLine={false} tickLine={false} minTickGap={24} />
                  <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} unit={data.burn.unit === "hours" ? "h" : ""} />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    labelFormatter={(label) => formatDateOnly(String(label))}
                    formatter={(value) => (value === null || value === undefined ? "-" : fmtUnit(Number(value)))}
                  />
                  <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
                  {burnMode === "down" ? (
                    <>
                      <Line type="monotone" dataKey="ideal" name="Ideal" stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="remaining" name={`Restante (${unit.trim()})`} stroke="var(--chart-2)" strokeWidth={2} dot={false} connectNulls={false} />
                    </>
                  ) : (
                    <>
                      <Line type="stepAfter" dataKey="scope" name="Escopo total" stroke="var(--muted-foreground)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="completed" name="Concluído" stroke="var(--chart-6)" strokeWidth={2} dot={false} />
                    </>
                  )}
                </LineChart>
              </ResponsiveContainer>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Medido em {data.burn.unit === "hours" ? "horas estimadas" : "quantidade de tarefas (sem estimativas)"}, considerando tarefas-folha.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tarefas por etapa</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiTypeChart
              data={stageData}
              nameKey="label"
              series={[{ key: "total", name: "Tarefas" }]}
              kind="bar-h"
              statusColorMap={stageColorMap}
              emptyMessage="Nenhuma tarefa"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Carga por responsável (horas em aberto x apontadas)</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiTypeChart
              data={workloadData}
              nameKey="name"
              series={[
                { key: "estimate", name: "Estimativa em aberto", color: "var(--chart-2)" },
                { key: "logged", name: "Horas apontadas", color: "var(--chart-6)" },
              ]}
              kind="bar-h"
              valueFormatter={(v) => formatHours(v)}
              emptyMessage="Nenhuma tarefa atribuída"
            />
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {data.workload.map((w) => (
                <span key={w.assigneeId ?? "none"}>
                  {w.name}: {w.open} aberta(s)
                  {w.overdue > 0 && <span className="text-destructive"> · {w.overdue} atrasada(s)</span>}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Horas apontadas por semana (12 semanas)</CardTitle>
          </CardHeader>
          <CardContent>
            <MultiTypeChart
              data={weekData}
              nameKey="week"
              series={[{ key: "hours", name: "Horas", color: "var(--chart-2)" }]}
              kind="bar-v"
              valueFormatter={(v) => formatHours(v)}
              emptyMessage="Nenhuma hora apontada"
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Próximos prazos e atrasos (14 dias)</CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nada vencendo nas próximas duas semanas.</p>
          ) : (
            <ul className="divide-y">
              {data.upcoming.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => actions.openTask(t.id)} className="flex w-full items-center gap-3 py-2 text-left text-sm hover:bg-muted/40">
                    <span className={cn("w-24 shrink-0 tabular-nums", t.overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                      {formatDateOnly(t.dueDate)}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{taskKey(projectCode, t.number)}</span>
                    {t.isMilestone && <Diamond className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                    <span className="flex-1 truncate">{t.title}</span>
                    <span className="hidden text-xs text-muted-foreground sm:inline">{t.assignee ?? "Sem responsável"}</span>
                    <StageBadge stage={data.stageCounts.find((st) => st.id === t.stageId)} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Resumo por etapa (tabela)</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          {data.stageCounts.map((s) => (
            <div key={s.id} className="rounded-md border p-2">
              <StageBadge stage={s} />
              <p className="mt-1 text-lg font-semibold tabular-nums">{s.count}</p>
            </div>
          ))}
          <div className="col-span-full pt-2">
            <ProgressCell value={kpis.progress} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
