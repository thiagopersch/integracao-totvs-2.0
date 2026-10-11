"use client"

import { useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ColorBadge } from "@/components/shared/color-badge"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { CustomFieldsFormSection } from "@/components/projects/custom-fields/custom-field-input"
import { createProject, updateProject } from "@/actions/projects"
import { projectSchema, type ProjectFormValues, type ProjectInput } from "@/schemas/project.schema"
import { buildCustomFieldsSchema, type CustomFieldDef, type CustomFieldValue, type CustomFieldValues } from "@/lib/custom-fields"
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_HEALTH_COLORS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
  type ProjectHealth,
  type ProjectStatus,
  type Priority,
} from "@/lib/projects"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import type { ProjectRow } from "@/services/project.service"
import type { projectService } from "@/services/project.service"

export type ProjectPickerOptions = Awaited<ReturnType<typeof projectService.listPickerOptions>>

const CONTRACT_STATUS_LABELS: Record<string, string> = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", EXPIRED: "Expirado", CANCELLED: "Cancelado" }

type Tab = "geral" | "escopo" | "prazos" | "equipe" | "campos"

const FIELD_TABS: Record<string, Tab> = {
  code: "geral",
  name: "geral",
  clientId: "geral",
  contractId: "geral",
  managerId: "geral",
  description: "geral",
  objective: "escopo",
  scope: "escopo",
  outOfScope: "escopo",
  assumptions: "escopo",
  successCriteria: "escopo",
  plannedStartDate: "prazos",
  plannedEndDate: "prazos",
  actualStartDate: "prazos",
  actualEndDate: "prazos",
  budgetHours: "prazos",
  budgetAmount: "prazos",
  memberIds: "equipe",
}

function dateValue(value: Date | string | null | undefined) {
  return value ? toDateInputValue(value) : ""
}

function toFormValues(project?: ProjectRow): ProjectFormValues {
  if (!project) {
    return {
      code: "",
      name: "",
      description: "",
      objective: "",
      scope: "",
      outOfScope: "",
      assumptions: "",
      successCriteria: "",
      clientId: "",
      contractId: "",
      managerId: "",
      sponsorName: "",
      memberIds: [],
      status: "PLANNING",
      health: null,
      priority: "MEDIUM",
      plannedStartDate: "",
      plannedEndDate: "",
      actualStartDate: "",
      actualEndDate: "",
      budgetHours: null,
      budgetAmount: null,
      color: "#6366f1",
      settings: {},
      customFields: {},
    }
  }
  return {
    code: project.code,
    name: project.name,
    description: project.description ?? "",
    objective: project.objective ?? "",
    scope: project.scope ?? "",
    outOfScope: project.outOfScope ?? "",
    assumptions: project.assumptions ?? "",
    successCriteria: project.successCriteria ?? "",
    clientId: project.client?.id ?? "",
    contractId: project.contract?.id ?? "",
    managerId: project.manager?.id ?? "",
    sponsorName: project.sponsorName ?? "",
    memberIds: project.members.map((m) => m.userId),
    status: project.status,
    health: project.manualHealth,
    priority: project.priority,
    plannedStartDate: dateValue(project.plannedStartDate),
    plannedEndDate: dateValue(project.plannedEndDate),
    actualStartDate: dateValue(project.actualStartDate),
    actualEndDate: dateValue(project.actualEndDate),
    budgetHours: project.budgetHours,
    budgetAmount: project.budgetAmount,
    color: project.color,
    settings: project.settings,
    customFields: project.customFields,
  }
}

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project?: ProjectRow
  options: ProjectPickerOptions
  defs: CustomFieldDef[]
  onSaved?: (id: string) => void
}

export function ProjectFormDialog({ open, onOpenChange, project, options, defs, onSaved }: ProjectFormDialogProps) {
  const [tab, setTab] = useState<Tab>("geral")
  const [loading, setLoading] = useState(false)
  const [cfErrors, setCfErrors] = useState<Record<string, { message?: string }>>({})

  const form = useForm<ProjectFormValues, unknown, ProjectInput>({
    mode: "onChange",
    resolver: zodResolver(projectSchema) as Resolver<ProjectFormValues, unknown, ProjectInput>,
    values: toFormValues(project),
  })
  const errors = form.formState.errors
  const clientId = form.watch("clientId") || ""
  const watchedMemberIds = form.watch("memberIds")
  const memberIds = useMemo(() => watchedMemberIds ?? [], [watchedMemberIds])
  const managerId = form.watch("managerId") || ""
  const customFields = (form.watch("customFields") ?? {}) as CustomFieldValues
  const settings = form.watch("settings") ?? {}

  const clientContracts = useMemo(() => options.contracts.filter((c) => c.clientId === clientId), [options.contracts, clientId])
  const usersWithoutAccess = useMemo(() => {
    if (!clientId) return []
    const ids = new Set([...memberIds, ...(managerId ? [managerId] : [])])
    return options.users.filter((u) => ids.has(u.id) && !u.clientIds.includes(clientId)).map((u) => u.name)
  }, [clientId, memberIds, managerId, options.users])

  function close() {
    setTab("geral")
    setCfErrors({})
    onOpenChange(false)
  }

  async function onSubmit(values: ProjectInput) {
    const cf = buildCustomFieldsSchema(defs).safeParse(values.customFields)
    if (!cf.success) {
      setCfErrors(Object.fromEntries(cf.error.issues.map((i) => [String(i.path[0]), { message: i.message }])))
      setTab("campos")
      toast.error("Verifique os campos personalizados")
      return
    }
    setCfErrors({})
    setLoading(true)
    const result = project ? await updateProject(project.id, values) : await createProject(values)
    setLoading(false)
    if (result.success) {
      toast.success(project ? "Projeto atualizado" : "Projeto criado")
      close()
      onSaved?.(project?.id ?? (result as { data?: { id: string } }).data?.id ?? "")
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  function onInvalid(fieldErrors: Record<string, unknown>) {
    const first = Object.keys(fieldErrors)[0]
    if (first && FIELD_TABS[first]) setTab(FIELD_TABS[first])
    toast.error("Verifique os campos destacados")
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{project ? `Editar Projeto ${project.code}` : "Novo Projeto"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody>
            <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList className="w-full">
                <TabsTrigger value="geral" className="flex-1">Geral</TabsTrigger>
                <TabsTrigger value="escopo" className="flex-1">Escopo</TabsTrigger>
                <TabsTrigger value="prazos" className="flex-1">Prazos e orçamento</TabsTrigger>
                <TabsTrigger value="equipe" className="flex-1">Equipe</TabsTrigger>
                <TabsTrigger value="campos" className="flex-1">Campos extras</TabsTrigger>
              </TabsList>

              <TabsContent value="geral" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px_1fr_80px]">
                  <Field>
                    <FieldLabel htmlFor="code">Código</FieldLabel>
                    <Input id="code" {...form.register("code")} placeholder="Automático" aria-invalid={!!errors.code} />
                    <FieldError errors={[errors.code]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="name">Nome do projeto</FieldLabel>
                    <Input id="name" {...form.register("name")} placeholder="Ex.: Implantação TOTVS RM — Financeiro" aria-invalid={!!errors.name} />
                    <FieldError errors={[errors.name]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="color">Cor</FieldLabel>
                    <Input id="color" type="color" className="h-9 p-1" {...form.register("color")} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Cliente</FieldLabel>
                    <Combobox
                      items={[{ value: "", label: "Projeto interno (sem cliente)" }, ...options.clients.map((c) => ({ value: c.id, label: c.name }))]}
                      value={clientId}
                      onValueChange={(v) => {
                        form.setValue("clientId", v, { shouldValidate: true })
                        if (!options.contracts.some((c) => c.id === form.getValues("contractId") && c.clientId === v)) {
                          form.setValue("contractId", "", { shouldValidate: true })
                        }
                      }}
                      renderItem={(item) => {
                        const client = options.clients.find((c) => c.id === item.value)
                        return client ? <ColorBadge label={client.name} color={client.color} solid /> : item.label
                      }}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Contrato (consome horas)</FieldLabel>
                    <OptionSelect
                      options={clientContracts.map((c) => ({
                        value: c.id,
                        label: `${c.contractedHours.toLocaleString("pt-BR")}h/mês · desde ${formatDateOnly(c.startDate)} · ${CONTRACT_STATUS_LABELS[c.status] ?? c.status}`,
                      }))}
                      value={form.watch("contractId")}
                      onChange={(v) => form.setValue("contractId", v, { shouldValidate: true })}
                      emptyLabel="Sem contrato"
                      disabled={!clientId}
                      invalid={!!errors.contractId}
                    />
                    <FieldDescription>Horas apontadas nas tarefas consomem as horas do contrato do cliente.</FieldDescription>
                    <FieldError errors={[errors.contractId]} />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field>
                    <FieldLabel>Status</FieldLabel>
                    <OptionSelect
                      options={toOptions(PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS)}
                      value={form.watch("status")}
                      onChange={(v) => form.setValue("status", (v || "PLANNING") as ProjectStatus)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Saúde</FieldLabel>
                    <OptionSelect
                      options={toOptions(PROJECT_HEALTH_LABELS, PROJECT_HEALTH_COLORS)}
                      value={form.watch("health")}
                      onChange={(v) => form.setValue("health", (v || null) as ProjectHealth | null)}
                      emptyLabel="Automática"
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Prioridade</FieldLabel>
                    <OptionSelect
                      options={toOptions(PRIORITY_LABELS, PRIORITY_COLORS)}
                      value={form.watch("priority")}
                      onChange={(v) => form.setValue("priority", (v || "MEDIUM") as Priority)}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel htmlFor="description">Descrição</FieldLabel>
                  <Textarea id="description" rows={3} {...form.register("description")} placeholder="Resumo do projeto" />
                  <FieldError errors={[errors.description]} />
                </Field>
              </TabsContent>

              <TabsContent value="escopo" className="mt-4 space-y-4">
                <Field>
                  <FieldLabel htmlFor="objective">Objetivo / justificativa</FieldLabel>
                  <Textarea id="objective" rows={3} {...form.register("objective")} placeholder="Por que o projeto existe e qual resultado de negócio ele entrega" />
                </Field>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="scope">Escopo (entregas)</FieldLabel>
                    <Textarea id="scope" rows={4} {...form.register("scope")} placeholder="O que será entregue" />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="outOfScope">Fora do escopo</FieldLabel>
                    <Textarea id="outOfScope" rows={4} {...form.register("outOfScope")} placeholder="O que explicitamente não será feito" />
                  </Field>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="assumptions">Premissas e restrições</FieldLabel>
                    <Textarea id="assumptions" rows={3} {...form.register("assumptions")} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="successCriteria">Critérios de sucesso / aceite</FieldLabel>
                    <Textarea id="successCriteria" rows={3} {...form.register("successCriteria")} />
                  </Field>
                </div>
              </TabsContent>

              <TabsContent value="prazos" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Início previsto</FieldLabel>
                    <DatePicker value={form.watch("plannedStartDate") || ""} onValueChange={(v) => form.setValue("plannedStartDate", v, { shouldValidate: true })} />
                    <FieldError errors={[errors.plannedStartDate]} />
                  </Field>
                  <Field>
                    <FieldLabel>Término previsto</FieldLabel>
                    <DatePicker
                      value={form.watch("plannedEndDate") || ""}
                      onValueChange={(v) => form.setValue("plannedEndDate", v, { shouldValidate: true })}
                      aria-invalid={!!errors.plannedEndDate}
                    />
                    <FieldError errors={[errors.plannedEndDate]} />
                  </Field>
                  <Field>
                    <FieldLabel>Início real</FieldLabel>
                    <DatePicker value={form.watch("actualStartDate") || ""} onValueChange={(v) => form.setValue("actualStartDate", v, { shouldValidate: true })} />
                    <FieldDescription>Preenchido automaticamente quando o projeto entra em andamento.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Término real</FieldLabel>
                    <DatePicker
                      value={form.watch("actualEndDate") || ""}
                      onValueChange={(v) => form.setValue("actualEndDate", v, { shouldValidate: true })}
                      aria-invalid={!!errors.actualEndDate}
                    />
                    <FieldError errors={[errors.actualEndDate]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="budgetHours">Orçamento em horas</FieldLabel>
                    <Input
                      id="budgetHours"
                      type="number"
                      min={0}
                      step="0.5"
                      {...form.register("budgetHours", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                    />
                    <FieldError errors={[errors.budgetHours]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="budgetAmount">Orçamento financeiro (R$)</FieldLabel>
                    <Input
                      id="budgetAmount"
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register("budgetAmount", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                    />
                    <FieldError errors={[errors.budgetAmount]} />
                  </Field>
                </div>

                <div className="space-y-3 rounded-md border p-3">
                  <p className="text-sm font-medium">Fluxo das tarefas (Kanban)</p>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {TASK_STATUSES.filter((s) => s !== "DONE" && s !== "CANCELLED").map((status) => (
                      <Field key={status}>
                        <FieldLabel htmlFor={`wip-${status}`}>Limite WIP — {TASK_STATUS_LABELS[status]}</FieldLabel>
                        <Input
                          id={`wip-${status}`}
                          type="number"
                          min={1}
                          placeholder="Sem limite"
                          value={settings.wipLimits?.[status] ?? ""}
                          onChange={(e) => {
                            const limits = { ...(settings.wipLimits ?? {}) }
                            if (e.target.value === "") delete limits[status]
                            else limits[status] = Math.max(1, Number(e.target.value))
                            form.setValue("settings", { ...settings, wipLimits: limits })
                          }}
                        />
                      </Field>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field orientation="horizontal">
                      <Switch
                        id="wipEnforced"
                        checked={!!settings.wipEnforced}
                        onCheckedChange={(c) => form.setValue("settings", { ...settings, wipEnforced: c })}
                      />
                      <div className="flex flex-col gap-1">
                        <FieldLabel htmlFor="wipEnforced">Bloquear ao exceder o limite WIP</FieldLabel>
                        <FieldDescription>Desligado, o limite apenas destaca a coluna em vermelho.</FieldDescription>
                      </div>
                    </Field>
                    <Field>
                      <FieldLabel htmlFor="dueSoonDays">Alertar prazo com antecedência de (dias)</FieldLabel>
                      <Input
                        id="dueSoonDays"
                        type="number"
                        min={0}
                        max={30}
                        placeholder="2"
                        value={settings.dueSoonDays ?? ""}
                        onChange={(e) => {
                          const next = { ...settings }
                          if (e.target.value === "") delete next.dueSoonDays
                          else next.dueSoonDays = Math.min(30, Math.max(0, Number(e.target.value)))
                          form.setValue("settings", next)
                        }}
                      />
                    </Field>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="equipe" className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field>
                    <FieldLabel>Gerente do projeto</FieldLabel>
                    <Combobox
                      items={[{ value: "", label: "Sem gerente" }, ...options.users.map((u) => ({ value: u.id, label: u.name }))]}
                      value={managerId}
                      onValueChange={(v) => form.setValue("managerId", v, { shouldValidate: true })}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="sponsorName">Patrocinador (sponsor)</FieldLabel>
                    <Input id="sponsorName" {...form.register("sponsorName")} placeholder="Quem patrocina e aprova o projeto" />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Membros da equipe</FieldLabel>
                  <MultiSelect
                    items={options.users.map((u) => ({ value: u.id, label: u.name }))}
                    value={memberIds}
                    onValueChange={(v) => form.setValue("memberIds", v, { shouldValidate: true })}
                    placeholder="Selecione os membros"
                  />
                  <FieldDescription>O gerente entra automaticamente na equipe. Só membros podem ser responsáveis por tarefas.</FieldDescription>
                  {usersWithoutAccess.length > 0 && (
                    <p className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                      <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                      Sem acesso ao cliente selecionado: {usersWithoutAccess.join(", ")}. Libere o cliente no cadastro do usuário.
                    </p>
                  )}
                  <FieldError errors={[errors.memberIds as { message?: string } | undefined]} />
                </Field>
              </TabsContent>

              <TabsContent value="campos" className="mt-4">
                <CustomFieldsFormSection
                  defs={defs}
                  values={customFields}
                  users={options.users}
                  errors={cfErrors}
                  onChange={(id: string, value: CustomFieldValue) => {
                    form.setValue("customFields", { ...customFields, [id]: value })
                    if (cfErrors[id])
                      setCfErrors((prev) => {
                        const next = { ...prev }
                        delete next[id]
                        return next
                      })
                  }}
                />
              </TabsContent>
            </Tabs>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={loading}>Cancelar</Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
