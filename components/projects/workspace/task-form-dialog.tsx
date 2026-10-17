"use client"

import { useMemo, useState } from "react"
import { Controller, useForm, type FieldErrors, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { DatePicker } from "@/components/ui/date-picker"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MarkdownEditor } from "@/components/shared/markdown-editor"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { CustomFieldsFormSection, type PickerUser } from "@/components/projects/custom-fields/custom-field-input"
import { createProjectTask, updateProjectTask } from "@/actions/project-tasks"
import { buildTaskFormSchema, type ProjectTaskFormValues, type ProjectTaskInput } from "@/schemas/project-task.schema"
import type { CustomFieldDef } from "@/lib/custom-fields"
import { descendantIds } from "@/lib/project-tasks"
import { PRIORITY_COLORS, PRIORITY_LABELS, type PhaseRef, type Priority, type StageRef } from "@/lib/projects"
import { toDateInputValue } from "@/utils/format"
import type { NewTaskDefaults, TaskDetail, TaskOptions, TeamMember } from "@/components/projects/workspace/types"

type TaskFormTab = "detalhes" | "planejamento" | "acompanhamento" | "propriedades"

/** Tab of each field — an invalid submit jumps to the tab of the first error. */
const FIELD_TAB: Record<string, TaskFormTab> = {
  title: "detalhes",
  description: "detalhes",
  stageId: "planejamento",
  phaseId: "planejamento",
  priority: "planejamento",
  assigneeId: "planejamento",
  parentId: "planejamento",
  startDate: "planejamento",
  dueDate: "planejamento",
  estimateHours: "planejamento",
  progress: "acompanhamento",
  isMilestone: "acompanhamento",
  tagIds: "acompanhamento",
}

const dateValue = (value: Date | string | null | undefined) => (value ? toDateInputValue(value) : "")

/** Default column of a new task: the requested one, else the first "a fazer" stage. */
function defaultStageId(stages: StageRef[], requested?: string) {
  if (requested && stages.some((s) => s.id === requested)) return requested
  return (stages.find((s) => s.category === "TODO") ?? stages.find((s) => s.category === "BACKLOG") ?? stages[0])?.id ?? ""
}

function toFormValues(task: TaskDetail | null | undefined, defaults: NewTaskDefaults, stages: StageRef[], team: TeamMember[]): ProjectTaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      stageId: defaultStageId(stages, defaults.stageId),
      phaseId: defaults.phaseId ?? "",
      priority: "MEDIUM",
      // A one-person team is the obvious assignee; the user can still clear it.
      assigneeId: defaults.assigneeId ?? (team.length === 1 ? team[0].id : ""),
      parentId: defaults.parentId ?? "",
      startDate: defaults.startDate ?? "",
      dueDate: defaults.dueDate ?? "",
      estimateHours: null,
      progress: 0,
      isMilestone: false,
      tagIds: [],
      customFields: {},
    }
  }
  return {
    title: task.title,
    description: task.description ?? "",
    stageId: task.stageId ?? defaultStageId(stages),
    phaseId: task.phaseId ?? "",
    priority: task.priority,
    assigneeId: task.assigneeId ?? "",
    parentId: task.parentId ?? "",
    startDate: dateValue(task.startDate),
    dueDate: dateValue(task.dueDate),
    estimateHours: task.estimateHours,
    progress: task.progress,
    isMilestone: task.isMilestone,
    tagIds: task.tags.map((t) => t.id),
    customFields: task.customFields,
  }
}

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  projectCode: string
  task?: TaskDetail | null
  defaults?: NewTaskDefaults
  stages: StageRef[]
  phases: PhaseRef[]
  team: TeamMember[]
  users: PickerUser[]
  options: TaskOptions
  defs: CustomFieldDef[]
  onSaved?: (taskId: string) => void
}

export function TaskFormDialog(props: TaskFormDialogProps) {
  const { open, onOpenChange, task, projectCode } = props
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Fixed height so switching tabs doesn't resize the dialog; each tab fits without scrolling. */}
      <DialogContent className="h-[min(600px,90dvh)] sm:max-w-2xl max-sm:h-[90dvh]! max-sm:max-h-[90dvh]!">
        <DialogHeader>
          <DialogTitle>{task ? `Editar ${projectCode}-${task.number}` : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        {open && <TaskFormBody key={task?.id ?? "new"} {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function TaskFormBody({ onOpenChange, projectId, projectCode, task, defaults = {}, stages, phases, team, users, options, defs, onSaved }: TaskFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState<TaskFormTab>("detalhes")
  const schema = useMemo(() => buildTaskFormSchema(defs), [defs])
  const form = useForm<ProjectTaskFormValues, unknown, ProjectTaskInput>({
    mode: "onChange",
    resolver: zodResolver(schema) as Resolver<ProjectTaskFormValues, unknown, ProjectTaskInput>,
    defaultValues: toFormValues(task, defaults, stages, team),
  })
  const errors = form.formState.errors
  const progress = form.watch("progress") ?? 0
  const stage = stages.find((s) => s.id === form.watch("stageId"))

  const parentOptions = useMemo(() => {
    const blocked = task ? new Set([task.id, ...descendantIds(options.tasks, task.id)]) : new Set<string>()
    return options.tasks.filter((t) => !blocked.has(t.id)).map((t) => ({ value: t.id, label: `${projectCode}-${t.number} ${t.title}` }))
  }, [options.tasks, task, projectCode])

  async function onSubmit(values: ProjectTaskInput) {
    setLoading(true)
    const result = task ? await updateProjectTask(projectId, task.id, values) : await createProjectTask(projectId, values)
    setLoading(false)
    if (result.success) {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada")
      if ("warning" in result && result.warning) toast.warning(result.warning)
      onOpenChange(false)
      onSaved?.(task?.id ?? (result as { data?: { id: string } }).data?.id ?? "")
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  function onInvalid(fieldErrors: FieldErrors<ProjectTaskFormValues>) {
    const first = Object.keys(fieldErrors)[0] ?? ""
    toast.error("Verifique os campos destacados")
    setTab(first === "customFields" ? "propriedades" : (FIELD_TAB[first] ?? "detalhes"))
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <Tabs value={tab} onValueChange={(v) => setTab(v as TaskFormTab)} className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="shrink-0 px-4 pt-4">
          <TabsList className="w-full">
            <TabsTrigger value="detalhes" className="flex-1">Detalhes</TabsTrigger>
            <TabsTrigger value="planejamento" className="flex-1">Planejamento</TabsTrigger>
            <TabsTrigger value="acompanhamento" className="flex-1">Acompanhamento</TabsTrigger>
            {defs.length > 0 && <TabsTrigger value="propriedades" className="flex-1">Propriedades</TabsTrigger>}
          </TabsList>
        </div>
        <DialogBody>
          <TabsContent value="detalhes" className="space-y-4">
            <Field>
              <FieldLabel htmlFor="task-title">Título</FieldLabel>
              <Input id="task-title" autoFocus {...form.register("title")} placeholder="O que precisa ser feito" aria-invalid={!!errors.title} />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-description">Descrição / critérios de aceite</FieldLabel>
              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <MarkdownEditor
                    id="task-description"
                    label="Descrição / critérios de aceite"
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    height={300}
                    invalid={!!errors.description}
                    placeholder="Contexto, passos, critérios de aceite… (aceita markdown)"
                  />
                )}
              />
              <FieldError errors={[errors.description]} />
            </Field>
          </TabsContent>
          <TabsContent value="planejamento" className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Etapa</FieldLabel>
                <Controller
                  control={form.control}
                  name="stageId"
                  render={({ field, fieldState }) => (
                    <OptionSelect
                      options={stages.map((s) => ({ value: s.id, label: s.name, color: s.color }))}
                      value={field.value}
                      onChange={(v) => {
                        field.onChange(v)
                        if (stages.find((s) => s.id === v)?.category === "DONE") form.setValue("progress", 100)
                      }}
                      invalid={!!fieldState.error}
                    />
                  )}
                />
                <FieldError errors={[errors.stageId]} />
              </Field>
              <Field>
                <FieldLabel>Fase</FieldLabel>
                <Controller
                  control={form.control}
                  name="phaseId"
                  render={({ field }) => (
                    <OptionSelect
                      options={phases.map((p) => ({ value: p.id, label: p.name, color: p.color }))}
                      value={field.value}
                      onChange={field.onChange}
                      emptyLabel="Sem fase"
                      disabled={phases.length === 0}
                    />
                  )}
                />
                {phases.length === 0 && <FieldDescription>Defina fases nas configurações do projeto.</FieldDescription>}
              </Field>
              <Field>
                <FieldLabel>Prioridade</FieldLabel>
                <Controller
                  control={form.control}
                  name="priority"
                  render={({ field }) => (
                    <OptionSelect options={toOptions(PRIORITY_LABELS, PRIORITY_COLORS).reverse()} value={field.value} onChange={(v) => field.onChange((v || "MEDIUM") as Priority)} />
                  )}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Responsável</FieldLabel>
                <Combobox
                  items={[{ value: "", label: "Sem responsável" }, ...team.map((m) => ({ value: m.id, label: m.name }))]}
                  value={form.watch("assigneeId") || ""}
                  onValueChange={(v) => form.setValue("assigneeId", v)}
                />
              </Field>
              <Field>
                <FieldLabel>Tarefa pai (EAP)</FieldLabel>
                <Combobox
                  items={[{ value: "", label: "Nenhuma (tarefa principal)" }, ...parentOptions]}
                  value={form.watch("parentId") || ""}
                  onValueChange={(v) => form.setValue("parentId", v)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Início</FieldLabel>
                <Controller control={form.control} name="startDate" render={({ field }) => <DatePicker value={field.value ?? ""} onValueChange={field.onChange} />} />
              </Field>
              <Field>
                <FieldLabel>Prazo</FieldLabel>
                <Controller
                  control={form.control}
                  name="dueDate"
                  render={({ field, fieldState }) => <DatePicker value={field.value ?? ""} onValueChange={field.onChange} aria-invalid={!!fieldState.error} />}
                />
                <FieldError errors={[errors.dueDate]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-estimate">Estimativa (horas)</FieldLabel>
                <Input
                  id="task-estimate"
                  type="number"
                  min={0}
                  step="0.5"
                  {...form.register("estimateHours", { setValueAs: (v) => (v === "" || v === null ? null : Number(v)) })}
                />
                <FieldError errors={[errors.estimateHours]} />
              </Field>
            </div>
          </TabsContent>
          <TabsContent value="acompanhamento" className="space-y-6">
            <Field>
              <FieldLabel>Tags</FieldLabel>
              <MultiSelect
                items={options.tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
                value={form.watch("tagIds") ?? []}
                onValueChange={(v) => form.setValue("tagIds", v)}
                placeholder="Selecione tags"
              />
            </Field>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Progresso: {progress}%</FieldLabel>
                <Slider value={progress} min={0} max={100} step={5} onValueChange={(v) => form.setValue("progress", v as number)} disabled={stage?.category === "DONE"} />
              </Field>
              <Field orientation="horizontal">
                <Switch id="task-milestone" checked={!!form.watch("isMilestone")} onCheckedChange={(c) => form.setValue("isMilestone", c)} />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="task-milestone">Marco (milestone)</FieldLabel>
                  <FieldDescription>Entrega-chave; aparece como losango no cronograma.</FieldDescription>
                </div>
              </Field>
            </div>
          </TabsContent>
          {defs.length > 0 && (
            <TabsContent value="propriedades" className="space-y-4">
              <CustomFieldsFormSection control={form.control} defs={defs} users={users} />
            </TabsContent>
          )}
        </DialogBody>
      </Tabs>
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
