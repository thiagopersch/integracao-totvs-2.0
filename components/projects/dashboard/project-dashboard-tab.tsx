"use client"

import { useState } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowRight, CalendarClock, FolderKanban, ListTodo, UserCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ColorBadge } from "@/components/shared/color-badge"
import { ChartCard } from "@/components/shared/charts/chart-card"
import type { ChartKind, ChartSeries } from "@/components/shared/charts/chart-types"
import { ProgressCell, ProjectHealthBadge, StageBadge } from "@/components/projects/project-badges"
import { DueDateLabel, PriorityDot, UserAvatar } from "@/components/projects/workspace/task-card-bits"
import { formatHours, taskKey } from "@/lib/projects"
import { formatDateOnly, formatNumber } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { ProjectPortfolio } from "@/services/project-portfolio.service"

type PortfolioTask = ProjectPortfolio["myTasks"][number]

const PROJECTS_HREF = "/projetos/gestao"
const VALUE_SERIES: ChartSeries[] = [{ key: "value", name: "Quantidade" }]
const ASSIGNEE_SERIES: ChartSeries[] = [{ key: "value", name: "Tarefas abertas", color: "var(--chart-1)" }]
const HOURS_SERIES: ChartSeries[] = [
  { key: "apontadas", name: "Horas apontadas", color: "var(--chart-2)" },
  { key: "orcamento", name: "Orçamento (horas)", color: "var(--chart-1)" },
]

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  title: string
  value: number | string
  hint: string
  icon: React.ComponentType<{ className?: string }>
  tone?: "danger" | "warning"
}) {
  return (
    <Link href={PROJECTS_HREF} className="block rounded-xl transition-opacity hover:opacity-80">
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div
            className="text-2xl font-bold"
            style={tone ? { color: tone === "danger" ? "var(--chart-critical)" : "var(--chart-warning)" } : undefined}
          >
            {value}
          </div>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

/** Visão Geral row: projects/tasks at a glance (current state, not period-filtered). */
export function ProjectKpiCards({ data }: { data: ProjectPortfolio }) {
  const { kpis } = data
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        title="Projetos Ativos"
        value={kpis.activeProjects}
        hint={kpis.atRiskProjects > 0 ? `${kpis.atRiskProjects} em atenção ou crítico` : `Total: ${kpis.totalProjects} · todos no prazo`}
        icon={FolderKanban}
        tone={kpis.atRiskProjects > 0 ? "warning" : undefined}
      />
      <KpiCard
        title="Tarefas Abertas"
        value={kpis.openTasks}
        hint={kpis.blockedTasks > 0 ? `${kpis.blockedTasks} bloqueada(s)` : "Nenhuma bloqueada"}
        icon={ListTodo}
      />
      <KpiCard
        title="Tarefas Atrasadas"
        value={kpis.overdueTasks}
        hint={`${kpis.dueSoonTasks} vencem nos próximos 7 dias`}
        icon={AlertTriangle}
        tone={kpis.overdueTasks > 0 ? "danger" : undefined}
      />
      <KpiCard
        title="Minhas Tarefas"
        value={kpis.myOpenTasks}
        hint={kpis.myDueSoonTasks > 0 ? `${kpis.myDueSoonTasks} atrasada(s) ou vencendo em 7 dias` : "Nada vencendo esta semana"}
        icon={UserCheck}
      />
    </div>
  )
}

function TaskRow({ task, today, showAssignee }: { task: PortfolioTask; today: string; showAssignee?: boolean }) {
  return (
    <Link
      href={`${PROJECTS_HREF}/${task.project.id}?task=${task.id}`}
      className="flex items-center gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted/60"
    >
      <PriorityDot priority={task.priority} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{task.title}</p>
        <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.project.color }} />
          <span className="font-mono">{taskKey(task.project.code, task.number)}</span>
          <span className="truncate">{task.project.name}</span>
        </p>
      </div>
      <div className="hidden shrink-0 sm:block">
        <StageBadge stage={task.stage} />
      </div>
      {showAssignee && task.assignee && <UserAvatar name={task.assignee.name} image={task.assignee.image} className="h-5 w-5" />}
      <DueDateLabel task={task} today={today} className="w-28 shrink-0 justify-end" />
    </Link>
  )
}

function TaskListCard({
  title,
  icon: Icon,
  tasks,
  today,
  empty,
  showAssignee,
}: {
  title: string
  icon: React.ComponentType<{ className?: string }>
  tasks: PortfolioTask[]
  today: string
  empty: string
  showAssignee?: boolean
}) {
  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && <Badge variant="outline">{tasks.length}</Badge>}
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="px-4">
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          <div className="divide-y">
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} today={today} showAssignee={showAssignee} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** "Projetos" tab of the dashboard. */
export function ProjectDashboardTab({ data, today }: { data: ProjectPortfolio; today: string }) {
  const [statusKind, setStatusKind] = useState<ChartKind>("donut")
  const [healthKind, setHealthKind] = useState<ChartKind>("pie")
  const [priorityKind, setPriorityKind] = useState<ChartKind>("donut")
  const [assigneeKind, setAssigneeKind] = useState<ChartKind>("bar-h")
  const [hoursKind, setHoursKind] = useState<ChartKind>("bar-v")
  const [hoursMeasure, setHoursMeasure] = useState<string>("apontadas")
  const { kpis, charts } = data

  return (
    <div className="space-y-4">
      <ProjectKpiCards data={data} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <div>
            <CardTitle className="text-sm font-medium">Projetos em atenção</CardTitle>
            <p className="text-xs text-muted-foreground">Projetos ativos, dos mais críticos para os saudáveis</p>
          </div>
          <Link href={PROJECTS_HREF} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
            Ver todos <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent>
          {data.attentionProjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhum projeto ativo</p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data.attentionProjects.map((p) => (
                <Link
                  key={p.id}
                  href={`${PROJECTS_HREF}/${p.id}`}
                  className={cn(
                    "flex flex-col gap-2 rounded-lg border p-3 transition-colors hover:bg-muted/40",
                    p.health === "RED" && "border-destructive/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                    <span className="font-mono text-xs text-muted-foreground">{p.code}</span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                    <ProjectHealthBadge health={p.health} auto={p.healthAuto} reasons={p.healthReasons} />
                  </div>
                  <ProgressCell value={p.progress} color={p.color} />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {p.client && <ColorBadge label={p.client.name} color={p.client.color} />}
                    <span>
                      {p.doneCount}/{p.taskCount} tarefas
                    </span>
                    {p.overdueCount > 0 && <span className="font-medium text-destructive">{p.overdueCount} atrasada(s)</span>}
                    {p.plannedEndDate && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" /> {formatDateOnly(p.plannedEndDate)}
                      </span>
                    )}
                    {p.manager && <span className="ml-auto truncate">{p.manager.name}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <TaskListCard
          title="Minhas tarefas"
          icon={UserCheck}
          tasks={data.myTasks}
          today={today}
          empty="Nenhuma tarefa aberta atribuída a você"
        />
        <TaskListCard
          title="Prazos: atrasadas e próximos 7 dias"
          icon={CalendarClock}
          tasks={data.dueTasks}
          today={today}
          empty="Nenhum prazo vencido ou próximo"
          showAssignee
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ChartCard
          title="Projetos por Status"
          data={charts.projectsByStatus}
          nameKey="name"
          series={VALUE_SERIES}
          kind={statusKind}
          onKindChange={setStatusKind}
          colorKey="color"
          emptyMessage="Nenhum projeto cadastrado"
          valueFormatter={formatNumber}
        />
        <ChartCard
          title="Saúde dos Projetos Ativos"
          data={charts.projectsByHealth}
          nameKey="name"
          series={VALUE_SERIES}
          kind={healthKind}
          onKindChange={setHealthKind}
          colorKey="color"
          emptyMessage="Nenhum projeto ativo"
          valueFormatter={formatNumber}
        />
        <ChartCard
          title="Tarefas Abertas por Prioridade"
          data={charts.tasksByPriority}
          nameKey="name"
          series={VALUE_SERIES}
          kind={priorityKind}
          onKindChange={setPriorityKind}
          colorKey="color"
          emptyMessage="Nenhuma tarefa aberta"
          valueFormatter={formatNumber}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tarefas Abertas por Responsável"
          data={charts.tasksByAssignee}
          nameKey="name"
          series={ASSIGNEE_SERIES}
          kind={assigneeKind}
          onKindChange={setAssigneeKind}
          emptyMessage="Nenhuma tarefa aberta"
          valueFormatter={formatNumber}
          height={300}
        />
        <ChartCard
          title={`Horas por Projeto — ${formatHours(kpis.loggedHours)} apontadas${kpis.budgetHours ? ` de ${formatHours(kpis.budgetHours)}` : ""}`}
          data={charts.hoursByProject}
          nameKey="name"
          series={HOURS_SERIES}
          kind={hoursKind}
          onKindChange={setHoursKind}
          measure={hoursMeasure}
          onMeasureChange={setHoursMeasure}
          emptyMessage="Nenhuma hora apontada em projetos ativos"
          valueFormatter={(v) => `${formatNumber(v)}h`}
          height={300}
        />
      </div>
    </div>
  )
}
