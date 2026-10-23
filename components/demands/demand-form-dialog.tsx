"use client"

import { useEffect, useState } from "react"
import { useForm, Controller, type Resolver, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, Maximize2, Minimize2 } from "lucide-react"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { MarkdownEditor } from "@/components/shared/markdown-editor"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelect } from "@/components/ui/multi-select"
import { autoPickSingle, departmentsForRequesters, pruneSelection, requestersForClient } from "@/lib/demand-cascade"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { createDemand, updateDemand } from "@/actions/demands"
import { listProjectTasksForDemand } from "@/actions/project-tasks"
import { createDemandSchema, updateDemandSchema, timeToMinutes, type CreateDemandInput } from "@/schemas/demand.schema"
import { toDateInputValue } from "@/utils/format"
import type { Analyst, Client, Department, DemandType, Requester, Tag } from "@/generated/prisma/client"


export const DEMAND_STATUS_LABELS: Record<string, string> = {
  PENDING: "Pendente",
  IN_PROGRESS: "Em Andamento",
  COMPLETED: "Concluída",
  CANCELLED: "Cancelada",
}

export const DEMAND_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f97316",
  IN_PROGRESS: "#3b82f6",
  COMPLETED: "#22c55e",
  CANCELLED: "#ef4444",
}

export const DEMAND_PRIORITY_LABELS: Record<string, string> = { LOW: "Baixa", MEDIUM: "Média", HIGH: "Alta", URGENT: "Urgente" }
export const DEMAND_PRIORITY_COLORS: Record<string, string> = { LOW: "#22c55e", MEDIUM: "#3b82f6", HIGH: "#f97316", URGENT: "#ef4444" }

const FIELD_LABELS: Record<string, string> = {
  name: "Nome",
  description: "Descrição",
  date: "Data",
  startTime: "Hora de início",
  endTime: "Hora de término",
  analystIds: "Analistas",
  clientId: "Cliente",
  requesterIds: "Solicitantes",
  departmentIds: "Setores",
  demandTypeIds: "Tipos",
  projectId: "Projeto",
  projectTaskId: "Tarefa",
}

const FIELD_TAB: Record<string, string> = {
  name: "identificacao",
  description: "identificacao",
  projectId: "atribuicao",
  projectTaskId: "atribuicao",
  analystIds: "atribuicao",
  clientId: "atribuicao",
  requesterIds: "atribuicao",
  departmentIds: "atribuicao",
  demandTypeIds: "atribuicao",
  date: "agendamento",
  startTime: "agendamento",
  endTime: "agendamento",
  priority: "agendamento",
  status: "agendamento",
  tagIds: "tags",
  notes: "tags",
}

export type DemandFormCatalogs = {
  analysts: Analyst[]
  clients: Client[]
  /** `clientId` + `departmentIds`/`requesterIds` drive the Cliente → Solicitantes → Setores cascade. */
  requesters: (Requester & { departmentIds?: string[] })[]
  departments: (Department & { clientIds: string[]; requesterIds: string[] })[]
  demandTypes: DemandType[]
  tags: Tag[]
}

export type DemandFormProject = { id: string; code: string; name: string; color: string; clientId: string }

export type DemandFormContext = { projects: DemandFormProject[]; myAnalystId: string | null }

/** Demand being edited — the shape the demands table and the project task sheet already have. */
export type DemandFormEntity = {
  id: string
  name: string
  description: string
  date: string | Date
  startTime: string | Date | null
  endTime: string | Date | null
  priority: string
  status: string
  notes: string | null
  demandAnalysts: { analyst: { id: string } }[]
  client: { id: string } | null
  demandRequesters: { requester: { id: string } }[]
  demandDepartments: { department: { id: string } }[]
  demandDemandTypes: { demandType: { id: string } }[]
  demandTags: { tag: { id: string } }[]
  project?: { id: string } | null
  projectTask?: { id: string } | null
}

export type DemandFormDefaults = { projectId?: string; projectTaskId?: string; clientId?: string; name?: string }

type TaskOption = { id: string; number: number; title: string }

function toTimeInputValue(d: string | Date | null): string {
  if (!d) return ""
  const date = typeof d === "string" ? new Date(d) : d
  return `${String(date.getUTCHours()).padStart(2, "0")}:${String(date.getUTCMinutes()).padStart(2, "0")}`
}

export function formatDurationHours(minutes: number): string {
  return (minutes / 60).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function initialValues(demand: DemandFormEntity | null | undefined, defaults: DemandFormDefaults, myAnalystId: string | null, today: string): CreateDemandInput {
  if (demand) {
    return {
      name: demand.name,
      description: demand.description,
      date: toDateInputValue(demand.date),
      startTime: toTimeInputValue(demand.startTime),
      endTime: toTimeInputValue(demand.endTime),
      priority: demand.priority,
      status: demand.status,
      notes: demand.notes ?? "",
      analystIds: demand.demandAnalysts.map((da) => da.analyst.id),
      clientId: demand.client?.id || "",
      requesterIds: demand.demandRequesters.map((dr) => dr.requester.id),
      departmentIds: demand.demandDepartments.map((dd) => dd.department.id),
      demandTypeIds: demand.demandDemandTypes.map((dt) => dt.demandType.id),
      tagIds: demand.demandTags.map((dt) => dt.tag.id),
      projectId: demand.project?.id || "",
      projectTaskId: demand.projectTask?.id || "",
    } as CreateDemandInput
  }
  return {
    name: defaults.name ?? "",
    description: "",
    date: today,
    startTime: "08:00",
    endTime: "09:00",
    priority: "MEDIUM",
    status: "PENDING",
    notes: "",
    analystIds: myAnalystId ? [myAnalystId] : [],
    clientId: defaults.clientId ?? "",
    requesterIds: [],
    departmentIds: [],
    demandTypeIds: [],
    tagIds: [],
    projectId: defaults.projectId ?? "",
    projectTaskId: defaults.projectTaskId ?? "",
  } as CreateDemandInput
}

interface DemandFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalogs: DemandFormCatalogs
  context: DemandFormContext
  /** Present = edit mode. */
  demand?: DemandFormEntity | null
  /** Pre-filled values of a new demand (e.g. "Apontar horas" on a project task). */
  defaults?: DemandFormDefaults
  /** Keeps project (and its client) fixed — used when opened from the project screen. */
  lockProject?: boolean
  /** Tasks of the pre-selected project, when the caller already has them (saves a round trip). */
  initialTasks?: TaskOption[]
  onSaved?: () => void
}

/**
 * The single demand form, shared by /demands and the project screen ("Apontar horas"): a demand
 * linked to a project (+ optional task) is that task's logged hours and consumes the client contract.
 */
export function DemandFormDialog(props: DemandFormDialogProps) {
  const { open, onOpenChange, demand } = props
  const [expanded, setExpanded] = useState(false)
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next)
        if (!next) setExpanded(false)
      }}
    >
      <DialogContent
        className={expanded ? "h-[99vh]! max-h-[99vh]! w-[99vw]! max-w-[99vw]!" : "h-auto max-h-[70vh] w-auto min-w-[min(40rem,90vw)] max-w-[70vw]"}
        headerActions={
          <WithTooltip label={expanded ? "Tamanho normal" : "Expandir"}>
            <Button type="button" variant="ghost" size="icon-sm" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? "Tamanho normal" : "Expandir"}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </WithTooltip>
        }
      >
        <DialogHeader>
          <DialogTitle>{demand ? "Editar Demanda" : "Nova Demanda"}</DialogTitle>
        </DialogHeader>
        {/* Mounted per opening so the fields start from the demand/defaults each time. */}
        {open && <DemandFormBody key={demand?.id ?? `new-${props.defaults?.projectTaskId ?? props.defaults?.projectId ?? ""}`} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function DemandFormBody({ onOpenChange, catalogs, context, demand, defaults = {}, lockProject, initialTasks, onSaved }: DemandFormDialogProps) {
  const { analysts, clients, requesters, departments, demandTypes, tags } = catalogs
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("identificacao")
  const [today] = useState(() => new Date().toISOString().slice(0, 10))
  const initial = initialValues(demand, defaults, context.myAnalystId, today)
  // A new demand opened with its client already set (e.g. from a project) gets the same single-option fill.
  if (!demand && initial.clientId) {
    initial.requesterIds = autoPickSingle([], requestersForClient(requesters, initial.clientId))
    initial.departmentIds = autoPickSingle([], departmentsForRequesters(departments, initial.clientId, initial.requesterIds))
  }
  const [tasks, setTasks] = useState<{ projectId: string; items: TaskOption[] }>(() => ({
    projectId: initial.projectId ?? "",
    items: initialTasks ?? [],
  }))
  const needsInitialTasks = !!initial.projectId && !initialTasks
  const [loadingTasks, setLoadingTasks] = useState(needsInitialTasks)

  // Editing a demand already linked to a project: load that project's tasks once.
  useEffect(() => {
    if (!needsInitialTasks) return
    let cancelled = false
    listProjectTasksForDemand(initial.projectId!).then((items) => {
      if (cancelled) return
      setTasks({ projectId: initial.projectId!, items })
      setLoadingTasks(false)
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const form = useForm<CreateDemandInput>({
    mode: "onChange",
    resolver: zodResolver(demand ? updateDemandSchema : createDemandSchema) as Resolver<CreateDemandInput>,
    defaultValues: initial,
  })
  const errors = form.formState.errors
  const projectId = form.watch("projectId") || ""
  const project = context.projects.find((p) => p.id === projectId)
  const watchedStartTime = form.watch("startTime")
  const watchedEndTime = form.watch("endTime")
  const previewMinutes =
    watchedStartTime && watchedEndTime && timeToMinutes(watchedEndTime) > timeToMinutes(watchedStartTime)
      ? timeToMinutes(watchedEndTime) - timeToMinutes(watchedStartTime)
      : 0

  async function loadTasks(nextProjectId: string) {
    if (!nextProjectId) return setTasks({ projectId: "", items: [] })
    setLoadingTasks(true)
    const items = await listProjectTasksForDemand(nextProjectId)
    setLoadingTasks(false)
    setTasks({ projectId: nextProjectId, items })
  }

  function selectProject(nextProjectId: string) {
    form.setValue("projectId", nextProjectId, { shouldValidate: true })
    form.setValue("projectTaskId", "", { shouldValidate: true })
    const next = context.projects.find((p) => p.id === nextProjectId)
    if (next) selectClient(next.clientId)
    void loadTasks(nextProjectId)
  }

  // Cascade: the client narrows the requesters, the client + requesters narrow the departments. Values already
  // saved on the demand stay listed while its client is unchanged, so legacy (unlinked) links don't vanish.
  const clientId = form.watch("clientId") || ""
  const requesterIds = form.watch("requesterIds") || []
  const keepSaved = !!demand && clientId === initial.clientId
  const requesterOptions = requestersForClient(requesters, clientId, keepSaved ? initial.requesterIds : [])
  const departmentOptions = departmentsForRequesters(departments, clientId, requesterIds, keepSaved ? initial.departmentIds : [])

  function selectRequesters(nextIds: string[]) {
    form.setValue("requesterIds", nextIds, { shouldValidate: true })
    const keep = keepSaved ? initial.departmentIds : []
    const options = departmentsForRequesters(departments, form.getValues("clientId") || "", nextIds, keep)
    const nextDepartmentIds = autoPickSingle(pruneSelection(form.getValues("departmentIds") || [], options), options)
    form.setValue("departmentIds", nextDepartmentIds, { shouldValidate: form.formState.isSubmitted })
  }

  function selectClient(nextClientId: string) {
    form.setValue("clientId", nextClientId, { shouldValidate: true })
    const keep = !!demand && nextClientId === initial.clientId
    const options = requestersForClient(requesters, nextClientId, keep ? initial.requesterIds : [])
    // A single requester/department option is filled in; with more than one the user picks.
    const nextRequesterIds = autoPickSingle(pruneSelection(form.getValues("requesterIds") || [], options), options)
    form.setValue("requesterIds", nextRequesterIds, { shouldValidate: form.formState.isSubmitted })
    const departmentOpts = departmentsForRequesters(departments, nextClientId, nextRequesterIds, keep ? initial.departmentIds : [])
    const nextDepartmentIds = autoPickSingle(pruneSelection(form.getValues("departmentIds") || [], departmentOpts), departmentOpts)
    form.setValue("departmentIds", nextDepartmentIds, { shouldValidate: form.formState.isSubmitted })
  }

  async function onSubmit(data: CreateDemandInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (Array.isArray(value)) value.forEach((id) => formData.append(key, id))
      else if (value !== undefined) formData.append(key, String(value))
    })
    const result = demand ? await updateDemand(demand.id, formData) : await createDemand(formData)
    setLoading(false)
    if (result.success) {
      toast.success(demand ? "Demanda atualizada" : "Demanda criada")
      onOpenChange(false)
      onSaved?.()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  function onInvalid(fieldErrors: FieldErrors<CreateDemandInput>) {
    const missing = Object.keys(fieldErrors).map((key) => FIELD_LABELS[key] || key)
    if (missing.length > 0) {
      toast.error(missing.length === 1 ? `Verifique o campo: ${missing[0]}` : `Verifique os campos: ${missing.join(", ")}`)
    }
    const tab = FIELD_TAB[Object.keys(fieldErrors)[0] ?? ""]
    if (tab) setActiveTab(tab)
  }

  const projectItems = context.projects
    .filter((p) => !form.watch("clientId") || lockProject || p.clientId === form.watch("clientId") || p.id === projectId)
    .map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <DialogBody>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as string)}>
          <TabsList className="w-full">
            <TabsTrigger value="identificacao" className="flex-1">Identificação</TabsTrigger>
            <TabsTrigger value="atribuicao" className="flex-1">Atribuição</TabsTrigger>
            <TabsTrigger value="agendamento" className="flex-1">Agendamento</TabsTrigger>
            <TabsTrigger value="tags" className="flex-1">Tags e Notas</TabsTrigger>
          </TabsList>

          <TabsContent value="identificacao" className="mt-4 space-y-4">
            <Field>
              <FieldLabel htmlFor="name">Nome da demanda</FieldLabel>
              <Input id="name" {...form.register("name")} placeholder="Nome da demanda" aria-invalid={!!errors.name} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="description">Descrição</FieldLabel>
              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <MarkdownEditor id="description" label="Descrição da demanda" value={field.value ?? ""} onChange={field.onChange} height={260} preview="live" />
                )}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </TabsContent>

          <TabsContent value="atribuicao" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 rounded-md border p-3 md:grid-cols-2">
              <Field>
                <FieldLabel>Projeto (opcional)</FieldLabel>
                {lockProject && project ? (
                  <div className="flex h-9 items-center gap-2 rounded-md border bg-muted/40 px-3 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: project.color }} />
                    {project.code} — {project.name}
                  </div>
                ) : (
                  <Combobox
                    items={[{ value: "", label: "Sem projeto" }, ...projectItems]}
                    value={projectId}
                    onValueChange={selectProject}
                    placeholder="Sem projeto"
                    searchPlaceholder="Buscar projeto..."
                  />
                )}
                <FieldError errors={[errors.projectId]} />
              </Field>
              <Field>
                <FieldLabel>Tarefa do projeto (opcional)</FieldLabel>
                <Combobox
                  items={[{ value: "", label: "Sem tarefa" }, ...tasks.items.map((t) => ({ value: t.id, label: `#${t.number} ${t.title}` }))]}
                  value={form.watch("projectTaskId") || ""}
                  onValueChange={(v) => form.setValue("projectTaskId", v, { shouldValidate: true })}
                  disabled={!projectId || loadingTasks}
                  placeholder={loadingTasks ? "Carregando tarefas..." : "Sem tarefa"}
                  searchPlaceholder="Buscar tarefa..."
                />
                <FieldError errors={[errors.projectTaskId]} />
              </Field>
              <FieldDescription className="md:col-span-2">
                Vinculada a um projeto, a demanda conta como horas apontadas na tarefa e no projeto — e consome o contrato do cliente uma única vez.
              </FieldDescription>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="analystIds">Analistas</FieldLabel>
                <MultiSelect
                  items={analysts.map((a) => ({ value: a.id, label: a.name, color: a.color }))}
                  value={form.watch("analystIds") || []}
                  onValueChange={(v) => form.setValue("analystIds", v, { shouldValidate: true })}
                  placeholder="Selecione os analistas"
                  searchPlaceholder="Buscar analista..."
                  emptyText="Nenhum analista encontrado."
                  className={errors.analystIds ? "border-destructive" : undefined}
                />
                <FieldError errors={[errors.analystIds]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
                <Select
                  items={clients.map((c) => ({ value: c.id, label: c.name }))}
                  value={form.watch("clientId") || null}
                  onValueChange={(v) => selectClient(v || "")}
                  disabled={!!project}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.clientId}>
                    <SelectValue placeholder="Selecione um cliente">
                      {(value: string) => {
                        const client = clients.find((c) => c.id === value)
                        return client ? <ColorBadge label={client.name} color={client.color} solid /> : "Selecione um cliente"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        <ColorBadge label={c.name} color={c.color} solid />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {project && <FieldDescription>Definido pelo projeto.</FieldDescription>}
                <FieldError errors={[errors.clientId]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="requesterIds">Solicitantes</FieldLabel>
                <MultiSelect
                  items={requesterOptions.map((r) => ({ value: r.id, label: r.name, color: r.color }))}
                  value={requesterIds}
                  onValueChange={selectRequesters}
                  placeholder={clientId ? "Selecione os solicitantes" : "Selecione um cliente primeiro"}
                  searchPlaceholder="Buscar solicitante..."
                  emptyText="Nenhum solicitante vinculado a este cliente."
                  disabled={!clientId}
                  className={errors.requesterIds ? "border-destructive" : undefined}
                />
                <FieldError errors={[errors.requesterIds]} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="departmentIds">Setores</FieldLabel>
                <MultiSelect
                  items={departmentOptions.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
                  value={form.watch("departmentIds") || []}
                  onValueChange={(v) => form.setValue("departmentIds", v, { shouldValidate: true })}
                  placeholder={requesterIds.length ? "Selecione os setores" : "Selecione um solicitante primeiro"}
                  searchPlaceholder="Buscar setor..."
                  emptyText="Nenhum setor vinculado aos solicitantes."
                  disabled={!requesterIds.length}
                  className={errors.departmentIds ? "border-destructive" : undefined}
                />
                <FieldError errors={[errors.departmentIds]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="demandTypeIds">Tipos</FieldLabel>
                <MultiSelect
                  items={demandTypes.map((d) => ({ value: d.id, label: d.name, color: d.color }))}
                  value={form.watch("demandTypeIds") || []}
                  onValueChange={(v) => form.setValue("demandTypeIds", v, { shouldValidate: true })}
                  placeholder="Selecione os tipos"
                  searchPlaceholder="Buscar tipo..."
                  emptyText="Nenhum tipo encontrado."
                  className={errors.demandTypeIds ? "border-destructive" : undefined}
                />
                <FieldError errors={[errors.demandTypeIds]} />
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="agendamento" className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="date">Data</FieldLabel>
                <DatePicker id="date" value={form.watch("date") || ""} onValueChange={(v) => form.setValue("date", v, { shouldValidate: true })} aria-invalid={!!errors.date} />
                <FieldError errors={[errors.date]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="startTime">Hora de início</FieldLabel>
                <TimePicker id="startTime" value={form.watch("startTime") || ""} onValueChange={(v) => form.setValue("startTime", v, { shouldValidate: true })} aria-invalid={!!errors.startTime} />
                <FieldError errors={[errors.startTime]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="endTime">Hora de término</FieldLabel>
                <TimePicker id="endTime" value={form.watch("endTime") || ""} onValueChange={(v) => form.setValue("endTime", v, { shouldValidate: true })} aria-invalid={!!errors.endTime} />
                <FieldError errors={[errors.endTime]} />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel>Duração</FieldLabel>
                <Input readOnly disabled value={previewMinutes > 0 ? `${formatDurationHours(previewMinutes)}h` : "-"} />
              </Field>
              <Field>
                <FieldLabel htmlFor="priority">Prioridade</FieldLabel>
                <Select
                  items={Object.entries(DEMAND_PRIORITY_LABELS).map(([value, label]) => ({ value, label }))}
                  value={form.watch("priority") || "MEDIUM"}
                  onValueChange={(v) => form.setValue("priority", v || "MEDIUM")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => (value ? <ColorBadge label={DEMAND_PRIORITY_LABELS[value]} color={DEMAND_PRIORITY_COLORS[value]} /> : "Selecione")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEMAND_PRIORITY_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <ColorBadge label={label} color={DEMAND_PRIORITY_COLORS[value]} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="status">Status</FieldLabel>
                <Select
                  items={Object.entries(DEMAND_STATUS_LABELS).map(([value, label]) => ({ value, label }))}
                  value={form.watch("status") || "PENDING"}
                  onValueChange={(v) => form.setValue("status", v || "PENDING")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {(value: string) => (value ? <ColorBadge label={DEMAND_STATUS_LABELS[value]} color={DEMAND_STATUS_COLORS[value]} /> : "Selecione")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(DEMAND_STATUS_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        <ColorBadge label={label} color={DEMAND_STATUS_COLORS[value]} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </TabsContent>

          <TabsContent value="tags" className="mt-4 space-y-4">
            <Field>
              <FieldLabel htmlFor="tagIds">Tags</FieldLabel>
              <MultiSelect
                items={tags.map((tag) => ({ value: tag.id, label: tag.name, color: tag.color }))}
                value={form.watch("tagIds") || []}
                onValueChange={(v) => form.setValue("tagIds", v)}
                placeholder="Selecione as tags"
                searchPlaceholder="Buscar tag..."
                emptyText="Nenhuma tag encontrada."
                disabled={tags.length === 0}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="notes">Notas</FieldLabel>
              <Textarea id="notes" {...form.register("notes")} placeholder="Notas adicionais (opcional)" />
            </Field>
          </TabsContent>
        </Tabs>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancelar</Button>
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </DialogFooter>
    </form>
  )
}
