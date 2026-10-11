"use client"

import { useMemo, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { DatePicker } from "@/components/ui/date-picker"
import { MultiSelect } from "@/components/ui/multi-select"
import { Combobox } from "@/components/ui/combobox"
import { Separator } from "@/components/ui/separator"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OptionSelect, toOptions } from "@/components/projects/option-select"
import { CustomFieldsFormSection, type PickerUser } from "@/components/projects/custom-fields/custom-field-input"
import { createProjectTask, updateProjectTask } from "@/actions/project-tasks"
import { projectTaskSchema, type ProjectTaskFormValues, type ProjectTaskInput } from "@/schemas/project-task.schema"
import { buildCustomFieldsSchema, type CustomFieldDef, type CustomFieldValue, type CustomFieldValues } from "@/lib/custom-fields"
import { descendantIds } from "@/lib/project-tasks"
import { PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUS_COLORS, TASK_STATUS_LABELS, type Priority, type TaskStatus } from "@/lib/projects"
import { toDateInputValue } from "@/utils/format"
import type { NewTaskDefaults, TaskDetail, TaskOptions, TeamMember } from "@/components/projects/workspace/types"

function dateValue(value: Date | string | null | undefined) {
  return value ? toDateInputValue(value) : ""
}

function toFormValues(task: TaskDetail | null | undefined, defaults: NewTaskDefaults = {}): ProjectTaskFormValues {
  if (!task) {
    return {
      title: "",
      description: "",
      status: defaults.status ?? "TODO",
      priority: "MEDIUM",
      assigneeId: defaults.assigneeId ?? "",
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
    status: task.status,
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
  team: TeamMember[]
  users: PickerUser[]
  options: TaskOptions
  defs: CustomFieldDef[]
  onSaved?: (taskId: string) => void
}

export function TaskFormDialog({ open, onOpenChange, projectId, projectCode, task, defaults, team, users, options, defs, onSaved }: TaskFormDialogProps) {
  const [loading, setLoading] = useState(false)
  const [cfErrors, setCfErrors] = useState<Record<string, { message?: string }>>({})
  const form = useForm<ProjectTaskFormValues, unknown, ProjectTaskInput>({
    mode: "onChange",
    resolver: zodResolver(projectTaskSchema) as Resolver<ProjectTaskFormValues, unknown, ProjectTaskInput>,
    values: toFormValues(task, defaults),
  })
  const errors = form.formState.errors
  const customFields = (form.watch("customFields") ?? {}) as CustomFieldValues
  const progress = form.watch("progress") ?? 0
  const status = form.watch("status") as TaskStatus

  const parentOptions = useMemo(() => {
    const blocked = task ? new Set([task.id, ...descendantIds(options.tasks, task.id)]) : new Set<string>()
    return options.tasks.filter((t) => !blocked.has(t.id)).map((t) => ({ value: t.id, label: `${projectCode}-${t.number} ${t.title}` }))
  }, [options.tasks, task, projectCode])

  function close() {
    setCfErrors({})
    onOpenChange(false)
  }

  async function onSubmit(values: ProjectTaskInput) {
    const cf = buildCustomFieldsSchema(defs).safeParse(values.customFields)
    if (!cf.success) {
      setCfErrors(Object.fromEntries(cf.error.issues.map((i) => [String(i.path[0]), { message: i.message }])))
      toast.error("Verifique os campos personalizados")
      return
    }
    setLoading(true)
    const result = task ? await updateProjectTask(projectId, task.id, values) : await createProjectTask(projectId, values)
    setLoading(false)
    if (result.success) {
      toast.success(task ? "Tarefa atualizada" : "Tarefa criada")
      if ("warning" in result && result.warning) toast.warning(result.warning)
      close()
      onSaved?.(task?.id ?? (result as { data?: { id: string } }).data?.id ?? "")
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task ? `Editar ${projectCode}-${task.number}` : "Nova tarefa"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit, () => toast.error("Verifique os campos destacados"))} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogBody>
            <Field>
              <FieldLabel htmlFor="task-title">Título</FieldLabel>
              <Input id="task-title" autoFocus {...form.register("title")} placeholder="O que precisa ser feito" aria-invalid={!!errors.title} />
              <FieldError errors={[errors.title]} />
            </Field>
            <Field>
              <FieldLabel htmlFor="task-description">Descrição / critérios de aceite</FieldLabel>
              <Textarea id="task-description" rows={4} {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Status</FieldLabel>
                <OptionSelect
                  options={toOptions(TASK_STATUS_LABELS, TASK_STATUS_COLORS)}
                  value={status}
                  onChange={(v) => {
                    form.setValue("status", (v || "TODO") as TaskStatus)
                    if (v === "DONE") form.setValue("progress", 100)
                  }}
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
              <Field>
                <FieldLabel>Responsável</FieldLabel>
                <Combobox
                  items={[{ value: "", label: "Sem responsável" }, ...team.map((m) => ({ value: m.id, label: m.name }))]}
                  value={form.watch("assigneeId") || ""}
                  onValueChange={(v) => form.setValue("assigneeId", v)}
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <Field>
                <FieldLabel>Início</FieldLabel>
                <DatePicker value={form.watch("startDate") || ""} onValueChange={(v) => form.setValue("startDate", v, { shouldValidate: true })} />
              </Field>
              <Field>
                <FieldLabel>Prazo</FieldLabel>
                <DatePicker
                  value={form.watch("dueDate") || ""}
                  onValueChange={(v) => form.setValue("dueDate", v, { shouldValidate: true })}
                  aria-invalid={!!errors.dueDate}
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Tarefa pai (EAP)</FieldLabel>
                <Combobox
                  items={[{ value: "", label: "Nenhuma (tarefa principal)" }, ...parentOptions]}
                  value={form.watch("parentId") || ""}
                  onValueChange={(v) => form.setValue("parentId", v)}
                />
              </Field>
              <Field>
                <FieldLabel>Tags</FieldLabel>
                <MultiSelect
                  items={options.tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))}
                  value={form.watch("tagIds") ?? []}
                  onValueChange={(v) => form.setValue("tagIds", v)}
                  placeholder="Selecione tags"
                />
              </Field>
            </div>
            <div className="grid grid-cols-1 items-end gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel>Progresso: {progress}%</FieldLabel>
                <Slider
                  value={progress}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => form.setValue("progress", v as number)}
                  disabled={status === "DONE"}
                />
              </Field>
              <Field orientation="horizontal">
                <Switch id="task-milestone" checked={!!form.watch("isMilestone")} onCheckedChange={(c) => form.setValue("isMilestone", c)} />
                <div className="flex flex-col gap-1">
                  <FieldLabel htmlFor="task-milestone">Marco (milestone)</FieldLabel>
                  <FieldDescription>Entrega-chave; aparece como losango no cronograma.</FieldDescription>
                </div>
              </Field>
            </div>
            {defs.length > 0 && (
              <>
                <Separator />
                <p className="text-sm font-medium">Campos personalizados</p>
                <CustomFieldsFormSection
                  defs={defs}
                  values={customFields}
                  users={users}
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
              </>
            )}
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
