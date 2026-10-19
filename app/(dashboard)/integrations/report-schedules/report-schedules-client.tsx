"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CalendarClock, Loader2, Pencil, Plus, Send, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmailListInput } from "@/components/shared/email-list-input"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { TimePicker } from "@/components/ui/time-picker"
import {
  createReportSchedule,
  deleteReportSchedule,
  previewReportSchedule,
  runReportScheduleNow,
  setReportScheduleActive,
  updateReportSchedule,
} from "@/actions/demand-report-schedules"
import { REPORT_PERIOD_KINDS, REPORT_PERIOD_LABELS, isReportPeriodKind } from "@/lib/report-period"
import { DEFAULT_REPORT_TIME, REPORT_SCHEDULE_LABELS, REPORT_SCHEDULES } from "@/lib/report-schedule"
import { APP_TIME_ZONE } from "@/utils/format"

export interface ScheduleRow {
  id: string
  name: string
  templateId: string
  templateName: string
  templateUsable: boolean
  templateEvent: string
  /** ALL_CLIENTS template: one email listing every client. */
  templateAllClients: boolean
  period: string
  clientIds: string[]
  toEmails: string[]
  ccEmails: string[]
  sendToClientEmail: boolean
  schedule: string
  scheduleTime: string | null
  dayOfMonth: number | null
  isActive: boolean
  nextRunAt: string | null
  lastRunAt: string | null
  lastRunStatus: string | null
  lastRunMessage: string | null
}

interface Props {
  schedules: ScheduleRow[]
  templates: ReportTemplate[]
  clients: { id: string; name: string; email: string | null }[]
  permissions: { create: boolean; update: boolean; delete: boolean; execute: boolean }
}

interface ReportTemplate {
  id: string
  name: string
  event: string
  scope: string
}

const MONTHLY_PERIODS = ["currentMonth", "previousMonth"]

/** "Consumo de horas · Todos os clientes" — shown next to each template name. */
function templateKindLabel(t: Pick<ReportTemplate, "event" | "scope">) {
  const report = t.event === "CONTRACT_USAGE" ? "Consumo de horas" : "Demandas"
  return `${report} · ${t.scope === "ALL_CLIENTS" ? "Todos os clientes" : "Por cliente"}`
}

interface FormState {
  name: string
  templateId: string
  period: string
  clientIds: string[]
  toEmails: string[]
  ccEmails: string[]
  sendToClientEmail: boolean
  schedule: string
  scheduleTime: string
  /** LAST_DAY = last day of the month. */
  dayOfMonth: string
  isActive: boolean
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "outline" }> = {
  SUCCESS: { label: "Enviado", variant: "success" },
  PARTIAL: { label: "Parcial", variant: "secondary" },
  FAILED: { label: "Falhou", variant: "destructive" },
  EMPTY: { label: "Sem demandas", variant: "outline" },
}

const LAST_DAY = "last"
const DAYS_OF_MONTH = [LAST_DAY, ...Array.from({ length: 31 }, (_, i) => String(i + 1))]
const dayLabel = (d: string) => (d === LAST_DAY ? "Último dia do mês" : `Dia ${d}`)

const formatDateTime = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        timeZone: APP_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—"

function describeSchedule(s: Pick<ScheduleRow, "schedule" | "scheduleTime" | "dayOfMonth">) {
  if (s.schedule === "NONE") return "Manual"
  const time = s.scheduleTime ?? DEFAULT_REPORT_TIME
  if (s.schedule === "MONTHLY") return `Mensal, ${s.dayOfMonth ? `dia ${s.dayOfMonth}` : "último dia"} às ${time}`
  if (s.schedule === "DAILY") return `Diário às ${time}`
  if (s.schedule === "WEEKLY") return `Semanal às ${time}`
  return REPORT_SCHEDULE_LABELS[s.schedule] ?? s.schedule
}

function emptyForm(templates: Props["templates"]): FormState {
  return {
    name: "Relatório mensal de demandas",
    templateId: templates[0]?.id ?? "",
    period: "currentMonth",
    clientIds: [],
    toEmails: [],
    ccEmails: [],
    sendToClientEmail: false,
    schedule: "MONTHLY",
    scheduleTime: DEFAULT_REPORT_TIME,
    dayOfMonth: LAST_DAY,
    isActive: true,
  }
}

function toForm(s: ScheduleRow): FormState {
  return {
    name: s.name,
    templateId: s.templateId,
    period: s.period,
    clientIds: s.clientIds,
    toEmails: s.toEmails,
    ccEmails: s.ccEmails,
    sendToClientEmail: s.sendToClientEmail,
    schedule: s.schedule,
    scheduleTime: s.scheduleTime ?? DEFAULT_REPORT_TIME,
    dayOfMonth: s.dayOfMonth ? String(s.dayOfMonth) : LAST_DAY,
    isActive: s.isActive,
  }
}

export function ReportSchedulesClient({ schedules, templates, clients, permissions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ open: boolean; id?: string }>({ open: false })
  const [form, setForm] = useState<FormState>(() => emptyForm(templates))
  const [saving, setSaving] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [runTarget, setRunTarget] = useState<{
    id: string
    name: string
    allClients: boolean
    periodLabel: string
    clients: { id: string; name: string; to: string[] }[]
    to: string[]
    cc: string[]
  } | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))
  const selectedTemplate = templates.find((t) => t.id === form.templateId)
  const formAllClients = selectedTemplate?.scope === "ALL_CLIENTS"
  const formUsage = selectedTemplate?.event === "CONTRACT_USAGE"
  const periodKinds = formUsage ? REPORT_PERIOD_KINDS.filter((k) => MONTHLY_PERIODS.includes(k)) : REPORT_PERIOD_KINDS

  function changeTemplate(templateId: string) {
    const template = templates.find((t) => t.id === templateId)
    const allClients = template?.scope === "ALL_CLIENTS"
    const usage = template?.event === "CONTRACT_USAGE"
    setForm((f) => ({
      ...f,
      templateId,
      // The single all-clients email never goes to each client's own address.
      sendToClientEmail: allClients ? false : f.sendToClientEmail,
      period: usage && !MONTHLY_PERIODS.includes(f.period) ? "currentMonth" : f.period,
    }))
  }

  function openNew() {
    setForm(emptyForm(templates))
    setEditing({ open: true })
  }

  function openEdit(row: ScheduleRow) {
    setForm(toForm(row))
    setEditing({ open: true, id: row.id })
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      scheduleTime: form.schedule === "NONE" ? null : form.scheduleTime,
      dayOfMonth: form.dayOfMonth === LAST_DAY ? null : Number(form.dayOfMonth),
    }
    const result = editing.id ? await updateReportSchedule(editing.id, payload) : await createReportSchedule(payload)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao salvar a regra de envio")
      return
    }
    toast.success(editing.id ? "Regra de envio atualizada" : "Regra de envio criada")
    setEditing({ open: false })
    router.refresh()
  }

  async function toggleActive(row: ScheduleRow, isActive: boolean) {
    setBusyId(row.id)
    const result = await setReportScheduleActive(row.id, isActive)
    setBusyId(null)
    if (!result.success) toast.error(result.error)
    router.refresh()
  }

  async function openRun(row: ScheduleRow) {
    setBusyId(row.id)
    const preview = await previewReportSchedule(row.id)
    setBusyId(null)
    if (!preview.success) {
      toast.error(preview.error)
      return
    }
    setRunTarget({
      id: row.id,
      name: row.name,
      allClients: preview.allClients,
      periodLabel: preview.periodLabel,
      clients: preview.clients,
      to: preview.to,
      cc: preview.cc,
    })
  }

  async function handleRun() {
    if (!runTarget) return
    setRunning(true)
    const result = await runReportScheduleNow(runTarget.id)
    setRunning(false)
    setRunTarget(null)
    if (result.success) toast.success(result.message)
    else toast.error(result.message)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deleteReportSchedule(deleteId)
    setDeleteId(null)
    if (result.success) toast.success("Regra de envio excluída")
    else toast.error(result.error)
    router.refresh()
  }

  const clientItems = clients.map((c) => ({ value: c.id, label: c.name }))

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Envio de Relatórios"
        description="Envia automaticamente o relatório de demandas do período (um e-mail por cliente ou um único e-mail com todos os clientes) e o consumo de horas de todos os clientes, conforme o escopo do template."
      >
        {permissions.create && (
          <Button onClick={openNew} disabled={templates.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Nova regra
          </Button>
        )}
      </PageHeader>

      {templates.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-sm">
            Nenhum template ativo do evento <strong>Relatório de demandas do período</strong> ou de{" "}
            <strong>Consumo de horas do contrato</strong> com escopo <strong>Todos os clientes</strong>.{" "}
            <Link href="/integrations/message-templates/new" className="text-primary underline">
              Crie um template
            </Link>{" "}
            (o anexo da planilha é configurado nele) antes de cadastrar uma regra de envio.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / template</TableHead>
                <TableHead>Destinatários</TableHead>
                <TableHead>Agendamento</TableHead>
                <TableHead>Próximo envio</TableHead>
                <TableHead>Último envio</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {schedules.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    Nenhuma regra de envio cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {schedules.map((row) => {
                const status = row.lastRunStatus ? STATUS_BADGE[row.lastRunStatus] : null
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {row.templateName}
                        <Badge variant="outline" className="ml-2">
                          {templateKindLabel({ event: row.templateEvent, scope: row.templateAllClients ? "ALL_CLIENTS" : "PER_CLIENT" })}
                        </Badge>
                        {!row.templateUsable && (
                          <Badge variant="destructive" className="ml-2">
                            template inativo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-56 text-xs">
                      <div className="truncate" title={row.toEmails.join(", ")}>
                        <span className="text-muted-foreground">Para: </span>
                        {[...row.toEmails, ...(row.sendToClientEmail && !row.templateAllClients ? ["e-mail do cliente"] : [])].join(", ") ||
                          "—"}
                      </div>
                      {row.ccEmails.length > 0 && (
                        <div className="truncate" title={row.ccEmails.join(", ")}>
                          <span className="text-muted-foreground">CC: </span>
                          {row.ccEmails.join(", ")}
                        </div>
                      )}
                      <div className="text-muted-foreground">
                        {row.clientIds.length
                          ? `${row.clientIds.length} cliente(s)`
                          : row.templateEvent === "CONTRACT_USAGE"
                            ? "Todos os clientes com contrato"
                            : "Todos os clientes com demanda"}
                        {row.templateAllClients && " · um único e-mail"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>{describeSchedule(row)}</div>
                      <div className="text-xs text-muted-foreground">
                        Período: {isReportPeriodKind(row.period) ? REPORT_PERIOD_LABELS[row.period] : row.period}
                      </div>
                    </TableCell>
                    <TableCell>{row.isActive ? formatDateTime(row.nextRunAt) : "—"}</TableCell>
                    <TableCell className="text-xs">
                      {formatDateTime(row.lastRunAt)}
                      {status && (
                        <div title={row.lastRunMessage ?? ""}>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={row.isActive}
                        disabled={!permissions.update || busyId === row.id}
                        onCheckedChange={(v) => toggleActive(row, v)}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        {permissions.execute && (
                          <WithTooltip label="Enviar agora">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Enviar agora"
                              disabled={busyId === row.id}
                              onClick={() => openRun(row)}
                            >
                              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                            </Button>
                          </WithTooltip>
                        )}
                        {permissions.update && (
                          <WithTooltip label="Editar">
                            <Button variant="ghost" size="icon-sm" aria-label="Editar" onClick={() => openEdit(row)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </WithTooltip>
                        )}
                        {permissions.delete && (
                          <WithTooltip label="Excluir">
                            <Button variant="ghost" size="icon-sm" aria-label="Excluir" onClick={() => setDeleteId(row.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </WithTooltip>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editing.open} onOpenChange={(open) => setEditing((e) => ({ ...e, open }))}>
        <DialogContent className="h-auto max-w-2xl sm:w-[42rem]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4" /> {editing.id ? "Editar regra de envio" : "Nova regra de envio"}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field>
              <FieldLabel htmlFor="rs-name">Nome</FieldLabel>
              <Input id="rs-name" value={form.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Template de e-mail</FieldLabel>
                <Select
                  items={templates.map((t) => ({ value: t.id, label: t.name }))}
                  value={form.templateId}
                  onValueChange={(v) => v && changeTemplate(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <span className="flex flex-col">
                          <span>{t.name}</span>
                          <span className="text-xs text-muted-foreground">{templateKindLabel(t)}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {selectedTemplate ? `${templateKindLabel(selectedTemplate)}. ` : ""}O anexo XLSX e o texto vêm do template.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Período de referência</FieldLabel>
                <Select
                  items={periodKinds.map((k) => ({ value: k, label: REPORT_PERIOD_LABELS[k] }))}
                  value={form.period}
                  onValueChange={(v) => v && patch({ period: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {periodKinds.map((k) => (
                      <SelectItem key={k} value={k}>
                        {REPORT_PERIOD_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  {formUsage ? "Mês de referência do consumo, calculado na data do envio." : "Calculado na data do envio (ex.: mês atual)."}
                </FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Clientes</FieldLabel>
              <MultiSelect
                items={clientItems}
                value={form.clientIds}
                onValueChange={(clientIds) => patch({ clientIds })}
                placeholder={formUsage ? "Todos os clientes com contrato vigente" : "Todos os clientes com demandas no período"}
                searchPlaceholder="Buscar cliente..."
              />
              <FieldDescription>
                {formUsage
                  ? "Um único e-mail com uma tabela por cliente. Clientes sem contrato vigente no mês são ignorados."
                  : formAllClients
                    ? "Um único e-mail com uma tabela por cliente, uma abaixo da outra. Clientes sem demandas no período são ignorados."
                    : "Um e-mail por cliente. Clientes sem demandas no período são ignorados."}
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel htmlFor="rs-to">Para</FieldLabel>
              <EmailListInput
                id="rs-to"
                value={form.toEmails}
                onChange={(toEmails) => patch({ toEmails })}
                placeholder="voce@empresa.com.br"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="rs-cc">Cópia (CC)</FieldLabel>
              <EmailListInput
                id="rs-cc"
                value={form.ccEmails}
                onChange={(ccEmails) => patch({ ccEmails })}
                placeholder="coordenador@empresa.com.br"
              />
            </Field>
            {!formAllClients && (
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rs-client-email"
                  checked={form.sendToClientEmail}
                  onCheckedChange={(v) => patch({ sendToClientEmail: v === true })}
                />
                <Label htmlFor="rs-client-email">Enviar também ao e-mail cadastrado do cliente</Label>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel>Frequência</FieldLabel>
                <Select
                  items={REPORT_SCHEDULES.map((s) => ({ value: s, label: REPORT_SCHEDULE_LABELS[s] }))}
                  value={form.schedule}
                  onValueChange={(v) => v && patch({ schedule: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_SCHEDULES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {REPORT_SCHEDULE_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              {form.schedule === "MONTHLY" && (
                <Field>
                  <FieldLabel>Dia do mês</FieldLabel>
                  <Select
                    items={DAYS_OF_MONTH.map((d) => ({ value: d, label: dayLabel(d) }))}
                    value={form.dayOfMonth}
                    onValueChange={(v) => v && patch({ dayOfMonth: v })}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DAYS_OF_MONTH.map((d) => (
                        <SelectItem key={d} value={d}>
                          {dayLabel(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}
              {form.schedule !== "NONE" && (
                <Field>
                  <FieldLabel htmlFor="rs-time">Horário</FieldLabel>
                  <TimePicker id="rs-time" value={form.scheduleTime} onValueChange={(scheduleTime) => patch({ scheduleTime })} />
                </Field>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch id="rs-active" checked={form.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
              <Label htmlFor="rs-active">Regra ativa</Label>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing({ open: false })}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!runTarget}
        onOpenChange={(open) => !open && setRunTarget(null)}
        title={`Enviar agora — ${runTarget?.name ?? ""}`}
        description={
          !runTarget
            ? ""
            : runTarget.clients.length === 0
              ? `Nenhum cliente para ${runTarget.periodLabel}.`
              : runTarget.allClients
                ? `1 e-mail com ${runTarget.clients.length} cliente(s) — ${runTarget.periodLabel} — para ${runTarget.to.join(", ") || "(sem destinatário)"}:`
                : `${runTarget.clients.length} e-mail(s) com as demandas de ${runTarget.periodLabel}:`
        }
        confirmLabel="Enviar"
        loading={running}
        loadingLabel="Enviando..."
        onConfirm={handleRun}
      >
        {runTarget && runTarget.clients.length > 0 && (
          <ul className="max-h-60 space-y-1 overflow-y-auto text-xs">
            {runTarget.clients.map((c) => (
              <li key={c.id}>
                <strong>{c.name}</strong>
                {!runTarget.allClients && (
                  <> → {c.to.join(", ") || <span className="text-destructive">sem destinatário</span>}</>
                )}
              </li>
            ))}
            {runTarget.cc.length > 0 && <li className="pt-1 text-muted-foreground">CC: {runTarget.cc.join(", ")}</li>}
          </ul>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir regra de envio?"
        description="Os envios agendados desta regra deixam de acontecer."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
