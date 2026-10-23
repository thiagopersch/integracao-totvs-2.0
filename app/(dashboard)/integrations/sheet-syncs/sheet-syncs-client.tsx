"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Copy, ExternalLink, FileSpreadsheet, KeyRound, Loader2, Pencil, PlugZap, Plus, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelect } from "@/components/ui/multi-select"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { TimePicker } from "@/components/ui/time-picker"
import { createSheetSync, deleteSheetSync, runSheetSyncNow, setSheetSyncActive, updateSheetSync } from "@/actions/demand-sheet-syncs"
import { saveGoogleSettings, testGoogleSheetAccess } from "@/actions/integrations/google-settings"
import { REPORT_PERIOD_LABELS, SHEET_SYNC_PERIODS, isReportPeriodKind } from "@/lib/report-period"
import { DEFAULT_REPORT_TIME, REPORT_SCHEDULES } from "@/lib/report-schedule"
import { APP_TIME_ZONE } from "@/utils/format"

export interface SheetSyncRow {
  id: string
  name: string
  spreadsheetUrl: string
  period: string
  clientIds: string[]
  analystIds: string[]
  schedule: string
  scheduleTime: string | null
  dayOfMonth: number | null
  syncOnDemandChange: boolean
  isActive: boolean
  nextRunAt: string | null
  pendingSyncAt: string | null
  lastRunAt: string | null
  lastRunStatus: string | null
  lastRunMessage: string | null
}

interface Props {
  syncs: SheetSyncRow[]
  clients: { id: string; name: string }[]
  analysts: { id: string; name: string }[]
  google: { serviceAccountEmail: string; enabled: boolean } | null
  canManageGoogle: boolean
  permissions: { create: boolean; update: boolean; delete: boolean; execute: boolean }
}

interface FormState {
  name: string
  spreadsheetUrl: string
  period: string
  clientIds: string[]
  analystIds: string[]
  schedule: string
  scheduleTime: string
  /** LAST_DAY = last day of the month. */
  dayOfMonth: string
  syncOnDemandChange: boolean
  isActive: boolean
}

const STATUS_BADGE: Record<string, { label: string; variant: "success" | "destructive" }> = {
  SUCCESS: { label: "Atualizada", variant: "success" },
  FAILED: { label: "Falhou", variant: "destructive" },
}

const SCHEDULE_LABELS: Record<string, string> = {
  NONE: "Sem agendamento",
  DAILY: "Diário",
  WEEKLY: "Semanal (a partir da data em que foi salvo)",
  MONTHLY: "Mensal",
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

function describeSchedule(s: Pick<SheetSyncRow, "schedule" | "scheduleTime" | "dayOfMonth">) {
  const time = s.scheduleTime ?? DEFAULT_REPORT_TIME
  if (s.schedule === "MONTHLY") return `Mensal, ${s.dayOfMonth ? `dia ${s.dayOfMonth}` : "último dia"} às ${time}`
  if (s.schedule === "DAILY") return `Diário às ${time}`
  if (s.schedule === "WEEKLY") return `Semanal às ${time}`
  return "Sem agendamento"
}

function emptyForm(): FormState {
  return {
    name: "Apontamento de horas",
    spreadsheetUrl: "",
    period: "currentMonth",
    clientIds: [],
    analystIds: [],
    schedule: "DAILY",
    scheduleTime: DEFAULT_REPORT_TIME,
    dayOfMonth: LAST_DAY,
    syncOnDemandChange: true,
    isActive: true,
  }
}

function toForm(s: SheetSyncRow): FormState {
  return {
    name: s.name,
    spreadsheetUrl: s.spreadsheetUrl,
    period: s.period === "previousMonth" ? "previousMonth" : "currentMonth",
    clientIds: s.clientIds,
    analystIds: s.analystIds,
    schedule: s.schedule,
    scheduleTime: s.scheduleTime ?? DEFAULT_REPORT_TIME,
    dayOfMonth: s.dayOfMonth ? String(s.dayOfMonth) : LAST_DAY,
    syncOnDemandChange: s.syncOnDemandChange,
    isActive: s.isActive,
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("E-mail copiado"),
    () => toast.error("Não foi possível copiar")
  )
}

function GoogleSettingsCard({ google, canManage }: { google: Props["google"]; canManage: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(!google && canManage)
  const [json, setJson] = useState("")
  const [enabled, setEnabled] = useState(google?.enabled ?? true)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    const result = await saveGoogleSettings({ serviceAccountJson: json, enabled })
    setSaving(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao salvar")
      return
    }
    toast.success("Conta de serviço salva")
    setJson("")
    setOpen(false)
    router.refresh()
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-6 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2 font-medium">
              <KeyRound className="h-4 w-4" /> Conta de serviço do Google
              {google && !google.enabled && <Badge variant="outline">desativada</Badge>}
            </div>
            {google ? (
              <div className="flex flex-wrap items-center gap-1 text-muted-foreground">
                Compartilhe cada planilha como <strong>Editor</strong> com
                <code className="rounded bg-muted px-1.5 py-0.5 text-foreground">{google.serviceAccountEmail}</code>
                <Button variant="ghost" size="icon-sm" aria-label="Copiar e-mail" onClick={() => copy(google.serviceAccountEmail)}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <div className="text-muted-foreground">
                {canManage
                  ? "Nenhuma conta de serviço configurada: cole abaixo a chave JSON para o sistema poder editar as planilhas."
                  : "Nenhuma conta de serviço configurada. Peça a um administrador para configurá-la."}
              </div>
            )}
          </div>
          {canManage && google && !open && (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              Alterar chave
            </Button>
          )}
        </div>

        {canManage && open && (
          <div className="space-y-3">
            <Field>
              <FieldLabel htmlFor="gs-key">{google ? "Nova chave JSON (opcional)" : "Chave JSON da conta de serviço"}</FieldLabel>
              <Textarea
                id="gs-key"
                rows={5}
                className="font-mono text-xs"
                value={json}
                onChange={(e) => setJson(e.target.value)}
                placeholder={google ? "Deixe em branco para manter a chave atual" : '{ "type": "service_account", "client_email": "...", "private_key": "..." }'}
              />
              <FieldDescription>
                No Google Cloud: ative a <strong>Google Sheets API</strong>, crie uma conta de serviço em IAM &gt; Contas de serviço e
                baixe uma chave do tipo JSON. Ela fica criptografada e nunca é exibida novamente.
              </FieldDescription>
            </Field>
            <div className="flex items-center gap-2">
              <Switch id="gs-enabled" checked={enabled} onCheckedChange={setEnabled} />
              <Label htmlFor="gs-enabled">Integração ativa</Label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Salvar
              </Button>
              {google && (
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SheetSyncsClient({ syncs, clients, analysts, google, canManageGoogle, permissions }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState<{ open: boolean; id?: string }>({ open: false })
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const patch = (p: Partial<FormState>) => setForm((f) => ({ ...f, ...p }))
  const clientItems = clients.map((c) => ({ value: c.id, label: c.name }))
  const clientName = new Map(clients.map((c) => [c.id, c.name]))
  const analystItems = analysts.map((a) => ({ value: a.id, label: a.name }))
  const analystName = new Map(analysts.map((a) => [a.id, a.name]))

  function openNew() {
    setForm(emptyForm())
    setEditing({ open: true })
  }

  function openEdit(row: SheetSyncRow) {
    setForm(toForm(row))
    setEditing({ open: true, id: row.id })
  }

  async function handleTest() {
    setTesting(true)
    const result = await testGoogleSheetAccess(form.spreadsheetUrl)
    setTesting(false)
    if (result.success) toast.success(result.message)
    else toast.error(result.error)
  }

  async function handleSave() {
    setSaving(true)
    const payload = {
      ...form,
      scheduleTime: form.schedule === "NONE" ? null : form.scheduleTime,
      dayOfMonth: form.dayOfMonth === LAST_DAY ? null : Number(form.dayOfMonth),
    }
    const result = editing.id ? await updateSheetSync(editing.id, payload) : await createSheetSync(payload)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao salvar a planilha")
      return
    }
    toast.success(editing.id ? "Planilha atualizada" : "Planilha cadastrada")
    setEditing({ open: false })
    router.refresh()
  }

  async function toggleActive(row: SheetSyncRow, isActive: boolean) {
    setBusyId(row.id)
    const result = await setSheetSyncActive(row.id, isActive)
    setBusyId(null)
    if (!result.success) toast.error(result.error)
    router.refresh()
  }

  async function handleRun(row: SheetSyncRow) {
    setBusyId(row.id)
    const result = await runSheetSyncNow(row.id)
    setBusyId(null)
    if (result.success) toast.success(result.message)
    else toast.error(result.message)
    router.refresh()
  }

  async function handleDelete() {
    if (!deleteId) return
    const result = await deleteSheetSync(deleteId)
    setDeleteId(null)
    if (result.success) toast.success("Planilha removida")
    else toast.error(result.error)
    router.refresh()
  }

  const describeClients = (ids: string[]) =>
    ids.length === 0
      ? "Todos os clientes com demandas"
      : ids.length === 1
        ? (clientName.get(ids[0]) ?? "1 cliente")
        : `${ids.length} clientes`

  return (
    <div className="space-y-4 p-4 md:p-6">
      <PageHeader
        title="Planilhas Google"
        description="Mantém o apontamento de horas no Google Sheets atualizado com as demandas do mês na aba do período (ex.: Outubro26), na frequência definida e logo após cada demanda lançada ou alterada."
      >
        {permissions.create && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Nova planilha
          </Button>
        )}
      </PageHeader>

      <GoogleSettingsCard google={google} canManage={canManageGoogle} />

      <Card>
        <CardContent className="overflow-x-auto pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome / planilha</TableHead>
                <TableHead>Clientes</TableHead>
                <TableHead>Atualização</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {syncs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma planilha cadastrada.
                  </TableCell>
                </TableRow>
              )}
              {syncs.map((row) => {
                const status = row.lastRunStatus ? STATUS_BADGE[row.lastRunStatus] : null
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <a
                        href={row.spreadsheetUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary underline"
                      >
                        Abrir planilha <ExternalLink className="h-3 w-3" />
                      </a>
                    </TableCell>
                    <TableCell className="max-w-56 text-xs">
                      <div className="truncate" title={row.clientIds.map((id) => clientName.get(id) ?? id).join(", ")}>
                        {describeClients(row.clientIds)}
                      </div>
                      <div className="text-muted-foreground">
                        Período: {isReportPeriodKind(row.period) ? REPORT_PERIOD_LABELS[row.period] : row.period}
                      </div>
                      {row.analystIds.length > 0 && (
                        <div className="truncate text-muted-foreground">
                          Analistas: {row.analystIds.map((id) => analystName.get(id) ?? id).join(", ")}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div>{describeSchedule(row)}</div>
                      {row.isActive && row.schedule !== "NONE" && (
                        <div className="text-muted-foreground">Próxima: {formatDateTime(row.nextRunAt)}</div>
                      )}
                      {row.syncOnDemandChange && <div className="text-muted-foreground">+ ao lançar/alterar demanda</div>}
                      {row.isActive && row.pendingSyncAt && (
                        <Badge variant="secondary" className="mt-1">
                          atualização pendente
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-64 text-xs">
                      {formatDateTime(row.lastRunAt)}
                      {status && (
                        <div title={row.lastRunMessage ?? ""}>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </div>
                      )}
                      {row.lastRunStatus === "FAILED" && row.lastRunMessage && (
                        <div className="mt-1 line-clamp-2 text-destructive">{row.lastRunMessage}</div>
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
                          <WithTooltip label="Atualizar agora">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Atualizar agora"
                              disabled={busyId === row.id || !google}
                              onClick={() => handleRun(row)}
                            >
                              {busyId === row.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
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
              <FileSpreadsheet className="h-4 w-4" /> {editing.id ? "Editar planilha" : "Nova planilha"}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field>
              <FieldLabel htmlFor="ss-name">Nome</FieldLabel>
              <Input id="ss-name" value={form.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field>
              <FieldLabel htmlFor="ss-url">Link da planilha</FieldLabel>
              <div className="flex gap-2">
                <Input
                  id="ss-url"
                  value={form.spreadsheetUrl}
                  onChange={(e) => patch({ spreadsheetUrl: e.target.value })}
                  placeholder="https://docs.google.com/spreadsheets/d/..."
                />
                <Button type="button" variant="outline" onClick={handleTest} disabled={testing || !form.spreadsheetUrl || !google}>
                  {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlugZap className="mr-2 h-4 w-4" />}
                  Testar acesso
                </Button>
              </div>
              <FieldDescription>
                {google ? (
                  <>
                    Compartilhe a planilha com <strong>{google.serviceAccountEmail}</strong> como Editor.{" "}
                  </>
                ) : null}
                Preenche as demandas na aba do mês (ex.: <strong>Outubro26</strong>) no layout dela; na virada do mês cria a aba
                seguinte (<strong>Novembro26</strong>) copiando a anterior. Nenhuma outra aba é criada ou alterada.
              </FieldDescription>
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel>Clientes</FieldLabel>
                <MultiSelect
                  items={clientItems}
                  value={form.clientIds}
                  onValueChange={(clientIds) => patch({ clientIds })}
                  placeholder="Todos os clientes com demandas no período"
                  searchPlaceholder="Buscar cliente..."
                />
                <FieldDescription>
                  Demandas destes clientes na aba do mês.
                </FieldDescription>
              </Field>
              <Field>
                <FieldLabel>Período de referência</FieldLabel>
                <Select
                  items={SHEET_SYNC_PERIODS.map((k) => ({ value: k, label: REPORT_PERIOD_LABELS[k] }))}
                  value={form.period}
                  onValueChange={(v) => v && patch({ period: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHEET_SYNC_PERIODS.map((k) => (
                      <SelectItem key={k} value={k}>
                        {REPORT_PERIOD_LABELS[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>Define a aba preenchida (mês atual = aba do mês da atualização).</FieldDescription>
              </Field>
            </div>

            <Field>
              <FieldLabel>Analistas</FieldLabel>
              <MultiSelect
                items={analystItems}
                value={form.analystIds}
                onValueChange={(analystIds) => patch({ analystIds })}
                placeholder="Todos os analistas"
                searchPlaceholder="Buscar analista..."
              />
              <FieldDescription>Para um apontamento por analista, selecione só o analista responsável pela planilha.</FieldDescription>
            </Field>

            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel>Frequência</FieldLabel>
                <Select
                  items={REPORT_SCHEDULES.map((s) => ({ value: s, label: SCHEDULE_LABELS[s] }))}
                  value={form.schedule}
                  onValueChange={(v) => v && patch({ schedule: v })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REPORT_SCHEDULES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {SCHEDULE_LABELS[s]}
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
                  <FieldLabel htmlFor="ss-time">Horário</FieldLabel>
                  <TimePicker id="ss-time" value={form.scheduleTime} onValueChange={(scheduleTime) => patch({ scheduleTime })} />
                </Field>
              )}
            </div>

            <div className="flex items-start gap-2">
              <Switch
                id="ss-on-change"
                checked={form.syncOnDemandChange}
                onCheckedChange={(syncOnDemandChange) => patch({ syncOnDemandChange })}
              />
              <div>
                <Label htmlFor="ss-on-change">Atualizar ao lançar ou alterar demanda</Label>
                <p className="text-xs text-muted-foreground">
                  Cerca de 2 minutos após a última alteração — várias alterações seguidas geram uma única atualização.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch id="ss-active" checked={form.isActive} onCheckedChange={(isActive) => patch({ isActive })} />
              <Label htmlFor="ss-active">Ativa</Label>
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
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Excluir planilha?"
        description="A planilha deixa de ser atualizada. O arquivo no Google Drive não é alterado nem excluído."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  )
}
