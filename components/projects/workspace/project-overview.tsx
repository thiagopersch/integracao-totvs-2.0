"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Diamond, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from "lucide-react"
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { DatePicker } from "@/components/ui/date-picker"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { ContractUsageBar } from "@/components/shared/contract-usage-bar"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { ProgressCell, StageBadge } from "@/components/projects/project-badges"
import { UserAvatar } from "@/components/projects/workspace/task-card-bits"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import { deleteProjectRisk, saveProjectRisk } from "@/actions/projects"
import {
  RISK_SCALE_COLORS,
  RISK_SCALE_LABELS,
  RISK_STATUS_COLORS,
  RISK_STATUS_LABELS,
  byPriority,
  formatHours,
  riskSeverity,
  taskKey,
  type RiskStatus,
} from "@/lib/projects"
import { MarkdownView } from "@/components/shared/markdown-editor"
import { isEmptyCustomFieldValue, type CustomFieldDef } from "@/lib/custom-fields"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { ProjectDashboardData, ProjectRisk, ProjectRow, ProjectTaskDTO, TeamMember, WorkspaceActions } from "@/components/projects/workspace/types"

type RiskForm = {
  title: string
  description: string
  probability: number
  impact: number
  status: RiskStatus
  ownerId: string
  mitigationPlan: string
  dueDate: string
}

const EMPTY_RISK: RiskForm = { title: "", description: "", probability: 3, impact: 3, status: "OPEN", ownerId: "", mitigationPlan: "", dueDate: "" }
const SCALE = [1, 2, 3, 4, 5]

function CharterBlock({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <MarkdownView value={value} className="mt-0.5" />
    </div>
  )
}

function RiskDialog({
  open,
  onOpenChange,
  projectId,
  risk,
  team,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  risk: ProjectRisk | null
  team: TeamMember[]
  onSaved: () => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{risk ? "Editar risco" : "Novo risco"}</DialogTitle>
        </DialogHeader>
        {open && <RiskFormBody key={risk?.id ?? "new"} onOpenChange={onOpenChange} projectId={projectId} risk={risk} team={team} onSaved={onSaved} />}
      </DialogContent>
    </Dialog>
  )
}

function RiskFormBody({
  onOpenChange,
  projectId,
  risk,
  team,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void
  projectId: string
  risk: ProjectRisk | null
  team: TeamMember[]
  onSaved: () => void
}) {
  const [form, setForm] = useState<RiskForm>(() =>
    risk
      ? {
          title: risk.title,
          description: risk.description ?? "",
          probability: risk.probability,
          impact: risk.impact,
          status: risk.status,
          ownerId: risk.ownerId ?? "",
          mitigationPlan: risk.mitigationPlan ?? "",
          dueDate: risk.dueDate ? toDateInputValue(risk.dueDate) : "",
        }
      : EMPTY_RISK
  )
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof RiskForm>(key: K, value: RiskForm[K]) => setForm((f) => ({ ...f, [key]: value }))
  const severity = riskSeverity(form.probability, form.impact)
  const scaleOptions = SCALE.map((n) => ({ value: String(n), label: `${n} — ${RISK_SCALE_LABELS[n]}`, color: RISK_SCALE_COLORS[n] }))

  async function save() {
    setSaving(true)
    const result = await saveProjectRisk(projectId, risk?.id ?? null, form)
    setSaving(false)
    if (result.success) {
      toast.success(risk ? "Risco atualizado" : "Risco registrado")
      onOpenChange(false)
      onSaved()
    } else toast.error(result.error || "Erro ao salvar risco")
  }

  return (
    <>
        <DialogBody>
          <Field>
            <FieldLabel htmlFor="risk-title">Risco</FieldLabel>
            <Input id="risk-title" value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ex.: Atraso na liberação do ambiente do cliente" />
          </Field>
          <Field>
            <FieldLabel htmlFor="risk-desc">Causa / impacto esperado</FieldLabel>
            <Textarea id="risk-desc" rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Probabilidade</FieldLabel>
              <OptionSelect options={scaleOptions} value={String(form.probability)} onChange={(v) => set("probability", Number(v) || 3)} />
            </Field>
            <Field>
              <FieldLabel>Impacto</FieldLabel>
              <OptionSelect options={scaleOptions} value={String(form.impact)} onChange={(v) => set("impact", Number(v) || 3)} />
            </Field>
          </div>
          <p className="text-sm">
            Severidade: <ColorBadge label={`${severity.label} (${form.probability * form.impact})`} color={severity.color} />
          </p>
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel>Status</FieldLabel>
              <OptionSelect options={toOptions(RISK_STATUS_LABELS, RISK_STATUS_COLORS)} value={form.status} onChange={(v) => set("status", (v || "OPEN") as RiskStatus)} />
            </Field>
            <Field>
              <FieldLabel>Responsável</FieldLabel>
              <Combobox items={[{ value: "", label: "Sem responsável" }, ...team.map((m) => ({ value: m.id, label: m.name }))]} value={form.ownerId} onValueChange={(v) => set("ownerId", v)} />
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="risk-plan">Plano de resposta / mitigação</FieldLabel>
            <Textarea id="risk-plan" rows={3} value={form.mitigationPlan} onChange={(e) => set("mitigationPlan", e.target.value)} />
          </Field>
          <Field>
            <FieldLabel>Revisar até</FieldLabel>
            <DatePicker value={form.dueDate} onValueChange={(v) => set("dueDate", v)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving || !form.title.trim()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
    </>
  )
}

/** 5×5 probability × impact heat map with the open risks placed in their cells. */
function RiskMatrix({ risks }: { risks: ProjectRisk[] }) {
  const open = risks.filter((r) => r.status !== "CLOSED")
  return (
    <div className="flex gap-2">
      <div className="flex flex-col justify-between py-1 text-[10px] text-muted-foreground [writing-mode:vertical-rl] rotate-180">Probabilidade</div>
      <div className="flex-1">
        <div className="grid grid-cols-5 gap-1">
          {[...SCALE].reverse().map((p) =>
            SCALE.map((i) => {
              const cell = open.filter((r) => r.probability === p && r.impact === i)
              const { color } = riskSeverity(p, i)
              return (
                <WithTooltip key={`${p}-${i}`} label={cell.length ? cell.map((r) => r.title).join(" · ") : `P${p} × I${i}`}>
                  <div
                    className="flex aspect-square items-center justify-center rounded text-xs font-semibold"
                    style={{ backgroundColor: `${color}${cell.length ? "66" : "1f"}` }}
                  >
                    {cell.length || ""}
                  </div>
                </WithTooltip>
              )
            })
          )}
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">Impacto</p>
      </div>
    </div>
  )
}

interface ProjectOverviewProps {
  project: ProjectRow
  tasks: ProjectTaskDTO[]
  dashboard: ProjectDashboardData
  risks: ProjectRisk[]
  defs: CustomFieldDef[]
  usersById: Record<string, string>
  team: TeamMember[]
  canUpdate: boolean
  actions: WorkspaceActions
}

export function ProjectOverview({ project, tasks, dashboard, risks, defs, usersById, team, canUpdate, actions }: ProjectOverviewProps) {
  const [riskDialog, setRiskDialog] = useState<{ open: boolean; risk: ProjectRisk | null }>({ open: false, risk: null })
  const [deleteRisk, setDeleteRisk] = useState<ProjectRisk | null>(null)
  const milestones = tasks
    .filter((t) => t.isMilestone)
    .sort((a, b) => byPriority(a, b) || (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity))
  const filledDefs = defs.filter((d) => !isEmptyCustomFieldValue(project.customFields[d.id]))
  const hasCharter = [project.objective, project.scope, project.outOfScope, project.assumptions, project.successCriteria, project.description].some(Boolean)

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Termo de abertura</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasCharter ? (
              <>
                <CharterBlock label="Descrição" value={project.description} />
                <CharterBlock label="Objetivo / justificativa" value={project.objective} />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <CharterBlock label="Escopo" value={project.scope} />
                  <CharterBlock label="Fora do escopo" value={project.outOfScope} />
                  <CharterBlock label="Premissas e restrições" value={project.assumptions} />
                  <CharterBlock label="Critérios de sucesso" value={project.successCriteria} />
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Objetivo, escopo, premissas e critérios de sucesso ainda não foram preenchidos — edite o projeto para registrar o termo de abertura.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldAlert className="h-4 w-4" /> Riscos
            </CardTitle>
            {canUpdate && (
              <CardAction>
                <Button size="sm" variant="outline" onClick={() => setRiskDialog({ open: true, risk: null })}>
                  <Plus className="mr-1 h-4 w-4" /> Novo risco
                </Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_200px]">
            <div className="space-y-2">
              {risks.length === 0 && <p className="text-sm text-muted-foreground">Nenhum risco registrado. Identifique o que pode atrasar ou comprometer o projeto.</p>}
              {risks.map((risk) => {
                const severity = riskSeverity(risk.probability, risk.impact)
                return (
                  <div key={risk.id} className={cn("group rounded-md border p-3", risk.status === "CLOSED" && "opacity-60")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <ColorBadge label={`${severity.label} · ${risk.probability * risk.impact}`} color={severity.color} />
                      <span className="flex-1 text-sm font-medium">{risk.title}</span>
                      <ColorBadge label={RISK_STATUS_LABELS[risk.status]} color={RISK_STATUS_COLORS[risk.status]} />
                      {canUpdate && (
                        <div className="flex opacity-0 group-hover:opacity-100 pointer-coarse:opacity-100">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setRiskDialog({ open: true, risk })}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDeleteRisk(risk)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {risk.mitigationPlan && <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">Resposta: {risk.mitigationPlan}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {risk.owner?.name ?? "Sem responsável"}
                      {risk.dueDate ? ` · revisar até ${formatDateOnly(risk.dueDate)}` : ""}
                    </p>
                  </div>
                )
              })}
            </div>
            <RiskMatrix risks={risks} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Cliente</span>
              <span>{project.client ? <ColorBadge label={project.client.name} color={project.client.color} solid /> : "Projeto interno"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Patrocinador</span>
              <span>{project.sponsorName ?? "-"}</span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Previsto</span>
              <span>
                {project.plannedStartDate ? formatDateOnly(project.plannedStartDate) : "?"} → {project.plannedEndDate ? formatDateOnly(project.plannedEndDate) : "?"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Real</span>
              <span>
                {project.actualStartDate ? formatDateOnly(project.actualStartDate) : "-"} → {project.actualEndDate ? formatDateOnly(project.actualEndDate) : "-"}
              </span>
            </div>
            <div className="flex justify-between gap-2">
              <span className="text-muted-foreground">Horas</span>
              <span>
                {formatHours(project.loggedHours)}
                {project.budgetHours ? ` / ${formatHours(project.budgetHours)}` : ""}
              </span>
            </div>
            {dashboard.usage && (
              <div className="space-y-1 pt-2">
                <span className="text-muted-foreground">Contrato do cliente (mês)</span>
                <ContractUsageBar {...dashboard.usage} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Equipe</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {team.length === 0 && <p className="text-sm text-muted-foreground">Nenhum membro. Edite o projeto para montar a equipe.</p>}
            {team.map((m) => (
              <div key={m.id} className="flex items-center gap-2 text-sm">
                <UserAvatar name={m.name} image={m.image} />
                <span className="flex-1">{m.name}</span>
                {project.manager?.id === m.id && <ColorBadge label="Gerente" color="#6366f1" />}
              </div>
            ))}
          </CardContent>
        </Card>

        {project.phases.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Fases</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.phases.map((phase) => {
                const phaseTasks = tasks.filter((t) => t.phaseId === phase.id && t.status !== "CANCELLED")
                const done = phaseTasks.filter((t) => t.status === "DONE").length
                return (
                  <div key={phase.id} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: phase.color }} />
                      <span className="flex-1 truncate font-medium">{phase.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {phase.startDate ? formatDateOnly(phase.startDate) : "?"} → {phase.endDate ? formatDateOnly(phase.endDate) : "?"}
                      </span>
                    </div>
                    <ProgressCell value={phaseTasks.length ? (done / phaseTasks.length) * 100 : 0} color={phase.color} />
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Marcos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {milestones.length === 0 && <p className="text-sm text-muted-foreground">Marque tarefas-chave como “marco” para acompanhá-las aqui.</p>}
            {milestones.map((m) => (
              <button key={m.id} type="button" className="flex w-full items-center gap-2 rounded px-1 py-1 text-left text-sm hover:bg-muted/50" onClick={() => actions.openTask(m.id)}>
                <Diamond className="h-3.5 w-3.5 shrink-0 fill-amber-500 text-amber-500" />
                <span className="flex-1 truncate">
                  <span className="font-mono text-xs text-muted-foreground">{taskKey(project.code, m.number)}</span> {m.title}
                </span>
                <span className="text-xs text-muted-foreground">{m.dueDate ? formatDateOnly(m.dueDate) : "-"}</span>
                <StageBadge stage={project.stages.find((st) => st.id === m.stageId)} />
              </button>
            ))}
          </CardContent>
        </Card>

        {filledDefs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Informações complementares</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {filledDefs.map((d) => (
                <div key={d.id} className="grid grid-cols-[120px_1fr] gap-2 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <CustomFieldValueView def={d} value={project.customFields[d.id]} usersById={usersById} />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <RiskDialog
        open={riskDialog.open}
        onOpenChange={(open) => setRiskDialog((s) => ({ ...s, open }))}
        projectId={project.id}
        risk={riskDialog.risk}
        team={team}
        onSaved={actions.refresh}
      />
      <ConfirmDialog
        open={!!deleteRisk}
        onOpenChange={(open) => !open && setDeleteRisk(null)}
        title="Excluir risco"
        description={`Excluir o risco "${deleteRisk?.title ?? ""}"?`}
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={async () => {
          if (!deleteRisk) return
          const result = await deleteProjectRisk(project.id, deleteRisk.id)
          setDeleteRisk(null)
          if (result.success) {
            toast.success("Risco excluído")
            actions.refresh()
          } else toast.error(result.error || "Erro ao excluir")
        }}
      />
    </div>
  )
}
