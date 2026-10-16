"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Controller, useFieldArray, useForm, type FieldErrors, type Resolver, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowLeft, GripVertical, Info, Loader2, Plus, Sparkles, Trash2, TriangleAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { DatePicker } from "@/components/ui/date-picker"
import { CurrencyInput } from "@/components/ui/currency-input"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, ScrollableTabsList, TabsTrigger } from "@/components/ui/tabs"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { MarkdownEditor } from "@/components/shared/markdown-editor"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { CustomFieldsFormSection } from "@/components/projects/custom-fields/custom-field-input"
import { createProject, updateProject } from "@/actions/projects"
import { buildProjectFormSchema, type ProjectFormValues, type ProjectInput } from "@/schemas/project.schema"
import type { CustomFieldDef } from "@/lib/custom-fields"
import {
  DEFAULT_PROJECT_SETTINGS,
  DEFAULT_STAGES,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PROJECT_HEALTH_COLORS,
  PROJECT_HEALTH_LABELS,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  STAGE_CATEGORY_LABELS,
  SUGGESTED_PHASES,
  TASK_STATUS_COLORS,
  WORKSPACE_VIEWS,
  WORKSPACE_VIEW_DESCRIPTIONS,
  WORKSPACE_VIEW_LABELS,
  type Priority,
  type ProjectHealth,
  type ProjectStatus,
  type TaskStatus,
  type WorkspaceView,
} from "@/lib/projects"
import { formatDateOnly, toDateInputValue } from "@/utils/format"
import { cn } from "@/lib/utils"
import type { ProjectRow, projectService } from "@/services/project.service"

export type ProjectPickerOptions = Awaited<ReturnType<typeof projectService.listPickerOptions>>

type FormValues = ProjectFormValues
type Form = UseFormReturn<FormValues, unknown, ProjectInput>

const CONTRACT_STATUS_LABELS: Record<string, string> = { ACTIVE: "Ativo", SUSPENDED: "Suspenso", EXPIRED: "Expirado", CANCELLED: "Cancelado" }

const TABS = [
  { value: "geral", label: "Geral" },
  { value: "escopo", label: "Escopo" },
  { value: "prazos", label: "Prazos e orçamento" },
  { value: "equipe", label: "Equipe" },
  { value: "etapas", label: "Etapas" },
  { value: "visualizacoes", label: "Visualizações" },
  { value: "propriedades", label: "Propriedades" },
] as const
type Tab = (typeof TABS)[number]["value"]

/** Tab holding each form field — used to jump to the first invalid one. */
const FIELD_TABS: Record<string, Tab> = {
  code: "geral",
  name: "geral",
  color: "geral",
  clientId: "geral",
  contractId: "geral",
  status: "geral",
  health: "geral",
  priority: "geral",
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
  managerId: "equipe",
  sponsorName: "equipe",
  memberIds: "equipe",
  stages: "etapas",
  phases: "etapas",
  settings: "visualizacoes",
  customFields: "propriedades",
}

const dateValue = (value: Date | string | null | undefined) => (value ? toDateInputValue(value) : "")

function toFormValues(project?: ProjectRow | null): FormValues {
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
      settings: { ...DEFAULT_PROJECT_SETTINGS },
      stages: DEFAULT_STAGES.map((s) => ({ ...s })),
      phases: [],
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
    stages: project.stages.map((s) => ({ id: s.id, name: s.name, color: s.color, category: s.category, wipLimit: s.wipLimit })),
    phases: project.phases.map((p) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      description: p.description ?? "",
      startDate: dateValue(p.startDate),
      endDate: dateValue(p.endDate),
    })),
    customFields: project.customFields,
  }
}

function SectionTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-0.5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  )
}

/** Sortable row shell with a drag handle (dnd-kit), shared by the stage and phase editors. */
function SortableRow({ id, children, className }: { id: string; children: React.ReactNode; className?: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("flex items-start gap-2 rounded-md border bg-background p-2", isDragging && "z-10 shadow-md", className)}
    >
      <button type="button" className="mt-2 cursor-grab touch-none text-muted-foreground" aria-label="Arrastar para reordenar" {...attributes} {...listeners}>
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  )
}

function StagesEditor({ form }: { form: Form }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "stages", keyName: "_key" })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const errors = form.formState.errors.stages
  const rootError = (errors as { message?: string; root?: { message?: string } } | undefined)?.message ?? (errors as { root?: { message?: string } } | undefined)?.root?.message
  const categoryOptions = (Object.keys(STAGE_CATEGORY_LABELS) as TaskStatus[]).map((c) => ({ value: c, label: STAGE_CATEGORY_LABELS[c], color: TASK_STATUS_COLORS[c] }))

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    move(fields.findIndex((f) => f._key === active.id), fields.findIndex((f) => f._key === over.id))
  }

  return (
    <div className="space-y-3">
      <div className="hidden grid-cols-[24px_44px_1fr_220px_110px_36px] gap-2 px-2 text-xs font-medium text-muted-foreground md:grid">
        <span />
        <span>Cor</span>
        <span>Nome da etapa</span>
        <span>Tipo (como conta no progresso)</span>
        <span>Limite WIP</span>
        <span />
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f._key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field, index) => {
              const rowErrors = form.formState.errors.stages?.[index]
              return (
                <SortableRow key={field._key} id={field._key}>
                  <div className="grid flex-1 grid-cols-[44px_1fr] gap-2 md:grid-cols-[44px_1fr_220px_110px]">
                    <Input type="color" className="h-9 w-11 p-1" aria-label="Cor da etapa" {...form.register(`stages.${index}.color`)} />
                    <div>
                      <Input placeholder="Ex.: Homologação" aria-invalid={!!rowErrors?.name} {...form.register(`stages.${index}.name`)} />
                      <FieldError errors={[rowErrors?.name]} />
                    </div>
                    <Controller
                      control={form.control}
                      name={`stages.${index}.category`}
                      render={({ field: f }) => <OptionSelect options={categoryOptions} value={f.value} onChange={(v) => f.onChange(v || "TODO")} className="col-span-2 md:col-span-1" />}
                    />
                    <Controller
                      control={form.control}
                      name={`stages.${index}.wipLimit`}
                      render={({ field: f, fieldState }) => (
                        <div className="col-span-2 md:col-span-1">
                          <Input
                            type="number"
                            min={1}
                            placeholder="Sem limite"
                            value={f.value ?? ""}
                            onChange={(e) => f.onChange(e.target.value === "" ? null : Number(e.target.value))}
                            aria-invalid={!!fieldState.error}
                          />
                          <FieldError errors={[fieldState.error]} />
                        </div>
                      )}
                    />
                  </div>
                  <WithTooltip label="Remover etapa">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)} disabled={fields.length <= 1}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </WithTooltip>
                </SortableRow>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      {rootError && <p className="text-sm text-destructive">{rootError}</p>}
      <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", color: "#64748b", category: "IN_PROGRESS", wipLimit: null })}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar etapa
      </Button>
    </div>
  )
}

function PhasesEditor({ form }: { form: Form }) {
  const { fields, append, remove, move } = useFieldArray({ control: form.control, name: "phases", keyName: "_key" })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    move(fields.findIndex((f) => f._key === active.id), fields.findIndex((f) => f._key === over.id))
  }

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Nenhuma fase definida — as tarefas ficam numa lista única no cronograma.
          <Button type="button" variant="outline" size="sm" onClick={() => SUGGESTED_PHASES.forEach((p) => append({ ...p, description: "", startDate: "", endDate: "" }))}>
            <Sparkles className="mr-1 h-4 w-4" /> Usar fases sugeridas (PMBOK)
          </Button>
        </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={fields.map((f) => f._key)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {fields.map((field, index) => {
              const rowErrors = form.formState.errors.phases?.[index]
              return (
                <SortableRow key={field._key} id={field._key}>
                  <div className="grid flex-1 grid-cols-[44px_1fr] gap-2 md:grid-cols-[44px_1fr_170px_170px]">
                    <Input type="color" className="h-9 w-11 p-1" aria-label="Cor da fase" {...form.register(`phases.${index}.color`)} />
                    <div>
                      <Input placeholder="Ex.: Planejamento" aria-invalid={!!rowErrors?.name} {...form.register(`phases.${index}.name`)} />
                      <FieldError errors={[rowErrors?.name]} />
                    </div>
                    <Controller
                      control={form.control}
                      name={`phases.${index}.startDate`}
                      render={({ field: f }) => <DatePicker value={f.value ?? ""} onValueChange={f.onChange} placeholder="Início" className="col-span-2 md:col-span-1" />}
                    />
                    <Controller
                      control={form.control}
                      name={`phases.${index}.endDate`}
                      render={({ field: f, fieldState }) => (
                        <div className="col-span-2 md:col-span-1">
                          <DatePicker value={f.value ?? ""} onValueChange={f.onChange} placeholder="Fim" aria-invalid={!!fieldState.error} />
                          <FieldError errors={[fieldState.error]} />
                        </div>
                      )}
                    />
                    <Textarea
                      rows={1}
                      className="col-span-2 min-h-9 md:col-span-4"
                      placeholder="Entregas / objetivo da fase (opcional)"
                      {...form.register(`phases.${index}.description`)}
                    />
                  </div>
                  <WithTooltip label="Remover fase">
                    <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0" onClick={() => remove(index)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </WithTooltip>
                </SortableRow>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
      {fields.length > 0 && (
        <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", color: "#0ea5e9", description: "", startDate: "", endDate: "" })}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar fase
        </Button>
      )}
    </div>
  )
}

interface ProjectSettingsFormProps {
  project?: ProjectRow | null
  options: ProjectPickerOptions
  defs: CustomFieldDef[]
}

/** Create/edit a project as a page with tabs (Geral, Escopo, Prazos, Equipe, Etapas, Visualizações, Propriedades). */
export function ProjectSettingsForm({ project, options, defs }: ProjectSettingsFormProps) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("geral")
  const [saving, setSaving] = useState(false)
  const schema = useMemo(() => buildProjectFormSchema(defs), [defs])
  const form = useForm<FormValues, unknown, ProjectInput>({
    mode: "onChange",
    resolver: zodResolver(schema) as Resolver<FormValues, unknown, ProjectInput>,
    defaultValues: toFormValues(project),
  })
  const errors = form.formState.errors
  const clientId = form.watch("clientId") || ""
  const watchedMemberIds = form.watch("memberIds")
  const managerId = form.watch("managerId") || ""
  const settings = form.watch("settings")
  const backHref = project ? `/projetos/gestao/${project.id}` : "/projetos/gestao"

  const clientContracts = useMemo(() => options.contracts.filter((c) => c.clientId === clientId), [options.contracts, clientId])
  const usersWithoutAccess = useMemo(() => {
    if (!clientId) return []
    const ids = new Set([...(watchedMemberIds ?? []), ...(managerId ? [managerId] : [])])
    return options.users.filter((u) => ids.has(u.id) && !u.clientIds.includes(clientId)).map((u) => u.name)
  }, [clientId, watchedMemberIds, managerId, options.users])

  async function onSubmit(values: ProjectInput) {
    setSaving(true)
    const result = project ? await updateProject(project.id, values) : await createProject(values)
    setSaving(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao salvar")
      return
    }
    toast.success(project ? "Projeto atualizado" : "Projeto criado")
    const id = project?.id ?? (result as { data?: { id: string } }).data?.id
    router.push(id ? `/projetos/gestao/${id}` : "/projetos/gestao")
  }

  function onInvalid(fieldErrors: FieldErrors<FormValues>) {
    const first = Object.keys(fieldErrors)[0]
    if (first && FIELD_TABS[first]) setTab(FIELD_TABS[first])
    toast.error("Verifique os campos destacados")
  }

  function toggleView(view: WorkspaceView, checked: boolean) {
    const current = settings.enabledViews ?? []
    const next = checked ? WORKSPACE_VIEWS.filter((v) => v === view || current.includes(v)) : current.filter((v) => v !== view)
    const defaultView = next.includes(settings.defaultView) ? settings.defaultView : (next[0] ?? settings.defaultView)
    form.setValue("settings", { ...settings, enabledViews: next, defaultView }, { shouldValidate: true })
  }

  const tabHasError = (value: Tab) => Object.keys(errors).some((key) => FIELD_TABS[key] === value)

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4">
      <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <div className="min-w-0">
          <Link href={backHref} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> {project ? project.name : "Projetos"}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{project ? `Configurações — ${project.code}` : "Novo projeto"}</h1>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(backHref)} disabled={saving}>Cancelar</Button>
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {project ? "Salvar alterações" : "Criar projeto"}
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <ScrollableTabsList>
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              {t.label}
              {tabHasError(t.value) && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-destructive" aria-label="contém erros" />}
            </TabsTrigger>
          ))}
        </ScrollableTabsList>

        <TabsContent value="geral" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <div className={cn("grid grid-cols-1 gap-4", project ? "sm:grid-cols-[160px_1fr_120px]" : "sm:grid-cols-[1fr_120px]")}>
                {/* The code is generated on create (PRJ-0001…) and kept on update. */}
                {project && (
                  <Field>
                    <FieldLabel htmlFor="code">Código</FieldLabel>
                    <Input id="code" value={project.code} disabled readOnly />
                    <FieldDescription>Gerado automaticamente</FieldDescription>
                  </Field>
                )}
                <Field>
                  <FieldLabel htmlFor="name">Nome do projeto</FieldLabel>
                  <Input id="name" {...form.register("name")} placeholder="Ex.: Implantação TOTVS RM — Financeiro" aria-invalid={!!errors.name} />
                  <FieldError errors={[errors.name]} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="color">Cor</FieldLabel>
                  <Input id="color" type="color" className="h-9 p-1" {...form.register("color")} />
                  <FieldDescription>Herdada do cliente</FieldDescription>
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
                      // The project inherits the client's color; it can still be changed afterwards.
                      const client = options.clients.find((c) => c.id === v)
                      if (client) form.setValue("color", client.color, { shouldDirty: true })
                      if (!options.contracts.some((c) => c.id === form.getValues("contractId") && c.clientId === v)) {
                        form.setValue("contractId", "", { shouldValidate: true })
                      }
                    }}
                    renderItem={(item) => {
                      const client = options.clients.find((c) => c.id === item.value)
                      return client ? <ColorBadge label={client.name} color={client.color} solid /> : item.label
                    }}
                  />
                  <FieldDescription>Necessário para apontar horas (as horas viram demandas do cliente).</FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Contrato de referência</FieldLabel>
                  <Controller
                    control={form.control}
                    name="contractId"
                    render={({ field, fieldState }) => (
                      <OptionSelect
                        options={clientContracts.map((c) => ({
                          value: c.id,
                          label: `${c.contractedHours.toLocaleString("pt-BR")}h/mês · desde ${formatDateOnly(c.startDate)} · ${CONTRACT_STATUS_LABELS[c.status] ?? c.status}`,
                        }))}
                        value={field.value}
                        onChange={field.onChange}
                        emptyLabel="Sem contrato"
                        disabled={!clientId}
                        invalid={!!fieldState.error}
                      />
                    )}
                  />
                  <FieldDescription>As demandas do projeto consomem as horas do contrato do cliente.</FieldDescription>
                  <FieldError errors={[errors.contractId]} />
                </Field>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field>
                  <FieldLabel>Status</FieldLabel>
                  <Controller
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <OptionSelect options={toOptions(PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS)} value={field.value} onChange={(v) => field.onChange((v || "PLANNING") as ProjectStatus)} />
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel>Saúde</FieldLabel>
                  <Controller
                    control={form.control}
                    name="health"
                    render={({ field }) => (
                      <OptionSelect
                        options={toOptions(PROJECT_HEALTH_LABELS, PROJECT_HEALTH_COLORS)}
                        value={field.value}
                        onChange={(v) => field.onChange((v || null) as ProjectHealth | null)}
                        emptyLabel="Automática"
                      />
                    )}
                  />
                </Field>
                <Field>
                  <FieldLabel>Prioridade</FieldLabel>
                  <Controller
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <OptionSelect options={toOptions(PRIORITY_LABELS, PRIORITY_COLORS)} value={field.value} onChange={(v) => field.onChange((v || "MEDIUM") as Priority)} />
                    )}
                  />
                </Field>
              </div>
              <Field>
                <FieldLabel htmlFor="description">Descrição</FieldLabel>
                <Textarea id="description" rows={3} {...form.register("description")} placeholder="Resumo do projeto em poucas linhas" />
                <FieldError errors={[errors.description]} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="escopo" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Por quê</CardTitle>
              <CardDescription>O problema ou oportunidade que justifica o projeto e o resultado de negócio esperado.</CardDescription>
            </CardHeader>
            <CardContent>
              <Field>
                <FieldLabel htmlFor="objective">Objetivo e justificativa</FieldLabel>
                <Controller
                  control={form.control}
                  name="objective"
                  render={({ field }) => (
                    <MarkdownEditor id="objective" label="Objetivo e justificativa" value={field.value ?? ""} onChange={field.onChange} height={160} invalid={!!errors.objective} placeholder="Ex.: Automatizar o fechamento financeiro, reduzindo de 5 para 2 dias o ciclo mensal." />
                  )}
                />
                <FieldError errors={[errors.objective]} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">O quê</CardTitle>
              <CardDescription>Deixe explícito o que será entregue e o que não faz parte — evita aumento de escopo sem controle.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="scope">Escopo incluído (entregas)</FieldLabel>
                <Controller
                  control={form.control}
                  name="scope"
                  render={({ field }) => (
                    <MarkdownEditor id="scope" label="Escopo incluído (entregas)" value={field.value ?? ""} onChange={field.onChange} height={200} invalid={!!errors.scope} placeholder={"- Parametrização do módulo X\n- Integração com Y\n- Treinamento da equipe"} />
                  )}
                />
                <FieldError errors={[errors.scope]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="outOfScope">Fora do escopo</FieldLabel>
                <Controller
                  control={form.control}
                  name="outOfScope"
                  render={({ field }) => (
                    <MarkdownEditor id="outOfScope" label="Fora do escopo" value={field.value ?? ""} onChange={field.onChange} height={200} invalid={!!errors.outOfScope} placeholder={"- Migração de dados históricos\n- Customizações de relatórios"} />
                  )}
                />
                <FieldError errors={[errors.outOfScope]} />
              </Field>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Condições</CardTitle>
              <CardDescription>O que se assume como verdadeiro, os limites do projeto e como as entregas serão aceitas.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="assumptions">Premissas e restrições</FieldLabel>
                <Controller
                  control={form.control}
                  name="assumptions"
                  render={({ field }) => (
                    <MarkdownEditor id="assumptions" label="Premissas e restrições" value={field.value ?? ""} onChange={field.onChange} height={180} invalid={!!errors.assumptions} placeholder={"Premissas: ambiente de homologação disponível\nRestrições: entrada em produção até 30/11"} />
                  )}
                />
                <FieldError errors={[errors.assumptions]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="successCriteria">Critérios de sucesso e aceite</FieldLabel>
                <Controller
                  control={form.control}
                  name="successCriteria"
                  render={({ field }) => (
                    <MarkdownEditor id="successCriteria" label="Critérios de sucesso e aceite" value={field.value ?? ""} onChange={field.onChange} height={180} invalid={!!errors.successCriteria} placeholder={"- Fechamento executado sem retrabalho manual\n- Aceite formal do patrocinador"} />
                  )}
                />
                <FieldError errors={[errors.successCriteria]} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prazos" className="mt-4">
          <Card>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-3">
                <SectionTitle title="Prazos" description="O início real é preenchido ao entrar em andamento e o término real ao concluir." />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {(["plannedStartDate", "plannedEndDate", "actualStartDate", "actualEndDate"] as const).map((name) => (
                    <Field key={name}>
                      <FieldLabel>{{ plannedStartDate: "Início previsto", plannedEndDate: "Término previsto", actualStartDate: "Início real", actualEndDate: "Término real" }[name]}</FieldLabel>
                      <Controller
                        control={form.control}
                        name={name}
                        render={({ field, fieldState }) => <DatePicker value={field.value ?? ""} onValueChange={field.onChange} aria-invalid={!!fieldState.error} />}
                      />
                      <FieldError errors={[errors[name]]} />
                    </Field>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <SectionTitle title="Orçamento" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <Field>
                    <FieldLabel htmlFor="budgetHours">Orçamento em horas</FieldLabel>
                    <Input
                      id="budgetHours"
                      type="number"
                      min={0}
                      step="0.5"
                      placeholder="0"
                      {...form.register("budgetHours", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                    />
                    <FieldError errors={[errors.budgetHours]} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="budgetAmount">Orçamento financeiro</FieldLabel>
                    <Controller
                      control={form.control}
                      name="budgetAmount"
                      render={({ field, fieldState }) => (
                        <CurrencyInput id="budgetAmount" value={field.value} onValueChange={field.onChange} onBlur={field.onBlur} aria-invalid={!!fieldState.error} />
                      )}
                    />
                    <FieldError errors={[errors.budgetAmount]} />
                  </Field>
                </div>
              </div>
              <div className="space-y-3">
                <SectionTitle title="Alertas de prazo" />
                <Field className="max-w-xs">
                  <FieldLabel htmlFor="dueSoonDays">Avisar o responsável com antecedência de (dias)</FieldLabel>
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
                      else next.dueSoonDays = Number(e.target.value)
                      form.setValue("settings", next, { shouldValidate: true })
                    }}
                  />
                  <FieldDescription>Tarefas atrasadas também geram alerta.</FieldDescription>
                  <FieldError errors={[errors.settings?.dueSoonDays]} />
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe" className="mt-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
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
                  value={watchedMemberIds ?? []}
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
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="etapas" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fases do projeto</CardTitle>
              <CardDescription>Grandes blocos do ciclo de vida, com datas. Agrupam as tarefas no cronograma e mostram o avanço por fase.</CardDescription>
            </CardHeader>
            <CardContent>
              <PhasesEditor form={form} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Fluxo de trabalho (colunas do Kanban)</CardTitle>
              <CardDescription>
                Etapas pelas quais cada tarefa passa, na ordem das colunas. O tipo define como a etapa conta no progresso e na saúde do projeto.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <StagesEditor form={form} />
              <div className="grid grid-cols-1 gap-4 rounded-md border bg-muted/30 p-3 lg:grid-cols-[1fr_auto]">
                <div className="flex gap-2 text-xs leading-relaxed text-muted-foreground">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>
                    <strong className="text-foreground">WIP (trabalho em andamento)</strong> é o máximo de tarefas que podem estar ao mesmo tempo numa etapa.
                    Limitar o WIP reduz a troca de contexto e expõe gargalos: com a coluna cheia, a equipe termina o que começou antes de puxar algo novo.
                    Defina limites nas etapas de execução (ex.: Em andamento = nº de pessoas da equipe) e deixe em branco onde não houver limite.
                    Com o bloqueio ligado, o Kanban impede mover tarefas para uma etapa cheia; desligado, a coluna apenas fica em vermelho.
                  </p>
                </div>
                <Field orientation="horizontal" className="items-center">
                  <Switch
                    id="wipEnforced"
                    checked={!!settings.wipEnforced}
                    onCheckedChange={(c) => form.setValue("settings", { ...settings, wipEnforced: c })}
                  />
                  <FieldLabel htmlFor="wipEnforced" className="whitespace-nowrap">Bloquear ao exceder o WIP</FieldLabel>
                </Field>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualizacoes" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Visualizações do projeto</CardTitle>
              <CardDescription>Escolha quais visões a equipe usa neste projeto e qual abre por padrão.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {WORKSPACE_VIEWS.map((view) => {
                  const enabled = settings.enabledViews.includes(view)
                  return (
                    <label
                      key={view}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors",
                        enabled ? "border-primary bg-primary/5" : "hover:bg-muted/50"
                      )}
                    >
                      <Checkbox checked={enabled} onCheckedChange={(c) => toggleView(view, !!c)} className="mt-0.5" />
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">
                          {WORKSPACE_VIEW_LABELS[view]}
                          {settings.defaultView === view && <ColorBadge label="Padrão" color="#6366f1" />}
                        </p>
                        <p className="text-xs text-muted-foreground">{WORKSPACE_VIEW_DESCRIPTIONS[view]}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
              <FieldError errors={[errors.settings?.enabledViews as { message?: string } | undefined]} />
              <Field className="max-w-xs">
                <FieldLabel>Abrir o projeto em</FieldLabel>
                <OptionSelect
                  options={settings.enabledViews.map((v) => ({ value: v, label: WORKSPACE_VIEW_LABELS[v] }))}
                  value={settings.defaultView}
                  onChange={(v) => v && form.setValue("settings", { ...settings, defaultView: v as WorkspaceView }, { shouldValidate: true })}
                />
                <FieldError errors={[errors.settings?.defaultView]} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="propriedades" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Propriedades</CardTitle>
              <CardDescription>Campos complementares definidos em Projetos → Propriedades.</CardDescription>
            </CardHeader>
            <CardContent>
              <CustomFieldsFormSection control={form.control} defs={defs} users={options.users} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </form>
  )
}
