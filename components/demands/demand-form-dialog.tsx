"use client"

import { useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { useForm, Controller, type Resolver, type FieldErrors } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2, Maximize2, Minimize2 } from "lucide-react"
import { ColorBadge } from "@/components/shared/color-badge"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { MultiSelect } from "@/components/ui/multi-select"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { createDemand, updateDemand } from "@/actions/demands"
import { listProjectTasksForDemand } from "@/actions/project-tasks"
import { createDemandSchema, updateDemandSchema, timeToMinutes, type CreateDemandInput } from "@/schemas/demand.schema"
import { toDateInputValue } from "@/utils/format"
import type { Analyst, Client, Department, DemandType, Requester, Tag } from "@/generated/prisma/client"
import "@uiw/react-md-editor/markdown-editor.css"

const MDEditor = dynamic(() => import("@uiw/react-md-editor"), { ssr: false })

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
  analystId: "Analista",
  clientId: "Cliente",
  requesterId: "Solicitante",
  departmentId: "Departamento",
  demandTypeId: "Tipo",
  projectId: "Projeto",
  projectTaskId: "Tarefa",
}

const FIELD_TAB: Record<string, string> = {
  name: "identificacao",
  description: "identificacao",
  projectId: "atribuicao",
  projectTaskId: "atribuicao",
  analystId: "atribuicao",
  clientId: "atribuicao",
  requesterId: "atribuicao",
  departmentId: "atribuicao",
  demandTypeId: "atribuicao",
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
  requesters: Requester[]
  departments: Department[]
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
  analyst: { id: string } | null
  client: { id: string } | null
  requester: { id: string } | null
  department: { id: string } | null
  demandType: { id: string } | null
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
      analystId: demand.analyst?.id || "",
      clientId: demand.client?.id || "",
      requesterId: demand.requester?.id || "",
      departmentId: demand.department?.id || "",
      demandTypeId: demand.demandType?.id || "",
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
    analystId: myAnalystId ?? "",
    clientId: defaults.clientId ?? "",
    requesterId: "",
    departmentId: "",
    demandTypeId: "",
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
        className={expanded ? "h-[99vh]! max-h-[99vh]! w-[99vw]! max-w-[99vw]!" : undefined}
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
    if (next) form.setValue("clientId", next.clientId, { shouldValidate: true })
    void loadTasks(nextProjectId)
  }

  async function onSubmit(data: CreateDemandInput) {
    setLoading(true)
    const formData = new FormData()
    Object.entries(data).forEach(([key, value]) => {
      if (key === "tagIds") return
      if (value !== undefined) formData.append(key, String(value))
    })
    for (const tagId of data.tagIds || []) formData.append("tagIds", tagId)
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
                  <div className="max-h-[260px] overflow-y-auto rounded-md border border-input" data-color-mode="auto">
                    <MDEditor value={field.value} onChange={(v) => field.onChange(v || "")} height={260} preview="live" visibleDragbar={false} />
                  </div>
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
                <FieldLabel htmlFor="analystId">Analista</FieldLabel>
                <Select
                  items={analysts.map((a) => ({ value: a.id, label: a.name }))}
                  value={form.watch("analystId") || null}
                  onValueChange={(v) => form.setValue("analystId", v || "", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.analystId}>
                    <SelectValue placeholder="Selecione um analista">
                      {(value: string) => {
                        const analyst = analysts.find((a) => a.id === value)
                        return analyst ? <ColorBadge label={analyst.name} color={analyst.color} /> : "Selecione um analista"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {analysts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        <ColorBadge label={a.name} color={a.color} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.analystId]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="clientId">Cliente</FieldLabel>
                <Select
                  items={clients.map((c) => ({ value: c.id, label: c.name }))}
                  value={form.watch("clientId") || null}
                  onValueChange={(v) => form.setValue("clientId", v || "", { shouldValidate: true })}
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
                <FieldLabel htmlFor="requesterId">Solicitante</FieldLabel>
                <Select
                  items={requesters.map((r) => ({ value: r.id, label: r.name }))}
                  value={form.watch("requesterId") || null}
                  onValueChange={(v) => form.setValue("requesterId", v || "", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.requesterId}>
                    <SelectValue placeholder="Selecione um solicitante" />
                  </SelectTrigger>
                  <SelectContent>
                    {requesters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.requesterId]} />
              </Field>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="departmentId">Departamento</FieldLabel>
                <Select
                  items={departments.map((d) => ({ value: d.id, label: d.name }))}
                  value={form.watch("departmentId") || null}
                  onValueChange={(v) => form.setValue("departmentId", v || "", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.departmentId}>
                    <SelectValue placeholder="Selecione um departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.departmentId]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="demandTypeId">Tipo</FieldLabel>
                <Select
                  items={demandTypes.map((d) => ({ value: d.id, label: d.name }))}
                  value={form.watch("demandTypeId") || null}
                  onValueChange={(v) => form.setValue("demandTypeId", v || "", { shouldValidate: true })}
                >
                  <SelectTrigger className="w-full" aria-invalid={!!errors.demandTypeId}>
                    <SelectValue placeholder="Selecione um tipo">
                      {(value: string) => {
                        const demandType = demandTypes.find((d) => d.id === value)
                        return demandType ? <ColorBadge label={demandType.name} color={demandType.color} /> : "Selecione um tipo"
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {demandTypes.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        <ColorBadge label={d.name} color={d.color} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[errors.demandTypeId]} />
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
