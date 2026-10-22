"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { ColorBadge } from "@/components/shared/color-badge"
import { ClientSelect } from "@/components/shared/client-select"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Combobox } from "@/components/ui/combobox"
import { Field, FieldDescription } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MultiSelect } from "@/components/ui/multi-select"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { departmentsForRequesters, requestersForClient } from "@/lib/demand-cascade"
import type { BulkListChange, BulkListMode } from "@/lib/demand-bulk"
import { bulkUpdateDemands } from "@/actions/demands"
import { listProjectTasksForDemand } from "@/actions/project-tasks"
import { bulkUpdateDemandSchema, type BulkUpdateDemandInput } from "@/schemas/demand.schema"
import {
  DEMAND_PRIORITY_COLORS,
  DEMAND_PRIORITY_LABELS,
  DEMAND_STATUS_COLORS,
  DEMAND_STATUS_LABELS,
  type DemandFormCatalogs,
  type DemandFormContext,
} from "@/components/demands/demand-form-dialog"

/** What the dialog needs from each selected row: its client and its requesters (for the department cascade). */
export type DemandBulkEditRow = { id: string; client: { id: string } | null; demandRequesters: { requester: { id: string } }[] }

type ListKey = "analystIds" | "requesterIds" | "departmentIds" | "demandTypeIds" | "tagIds"
type SimpleKey = "name" | "description" | "notes" | "date" | "startTime" | "endTime" | "priority" | "status" | "clientId" | "project"
type FieldKey = ListKey | SimpleKey

const MODE_LABELS: Record<BulkListMode, string> = { add: "Adicionar", replace: "Substituir", remove: "Remover" }

interface DemandBulkEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rows: DemandBulkEditRow[]
  catalogs: DemandFormCatalogs
  context: DemandFormContext
  /** `allUpdated` is false when some demands failed, so the caller can keep them selected. */
  onSaved: (allUpdated: boolean) => void
}

export function DemandBulkEditDialog(props: DemandBulkEditDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="h-auto max-h-[85vh] sm:max-w-2xl">
        {props.open && <DemandBulkEditBody {...props} />}
      </DialogContent>
    </Dialog>
  )
}

function DemandBulkEditBody({ onOpenChange, rows, catalogs, context, onSaved }: DemandBulkEditDialogProps) {
  const { analysts, clients, requesters, departments, demandTypes, tags } = catalogs
  const [loading, setLoading] = useState(false)
  const [enabled, setEnabled] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [values, setValues] = useState({
    name: "",
    description: "",
    notes: "",
    date: "",
    startTime: "",
    endTime: "",
    priority: "MEDIUM",
    status: "PENDING",
    clientId: "",
    projectId: "",
    projectTaskId: "",
  })
  const [lists, setLists] = useState<Record<ListKey, BulkListChange>>({
    analystIds: { mode: "add", ids: [] },
    requesterIds: { mode: "replace", ids: [] },
    departmentIds: { mode: "replace", ids: [] },
    demandTypeIds: { mode: "add", ids: [] },
    tagIds: { mode: "add", ids: [] },
  })
  const [tasks, setTasks] = useState<{ id: string; number: number; title: string }[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)

  // Requesters/departments/projects belong to a client: the new one, or the one every selected demand shares.
  const rowClientIds = [...new Set(rows.map((r) => r.client?.id ?? ""))]
  const commonClientId = rowClientIds.length === 1 ? rowClientIds[0] : ""
  const targetClientId = enabled.clientId ? values.clientId : commonClientId
  const peopleLocked = !!enabled.clientId

  const requesterOptions = requestersForClient(requesters, targetClientId)
  // Departments follow the requesters the demands will have: the chosen ones (replace) or the current + added.
  const cascadeRequesterIds =
    enabled.requesterIds && lists.requesterIds.mode === "replace"
      ? lists.requesterIds.ids
      : [...new Set([...rows.flatMap((r) => r.demandRequesters.map((dr) => dr.requester.id)), ...(enabled.requesterIds ? lists.requesterIds.ids : [])])]
  const departmentOptions = departmentsForRequesters(departments, targetClientId, cascadeRequesterIds)
  const projectItems = context.projects.filter((p) => p.clientId === targetClientId).map((p) => ({ value: p.id, label: `${p.code} — ${p.name}` }))

  function toggle(key: FieldKey, on: boolean) {
    setEnabled((prev) => {
      const next = { ...prev, [key]: on }
      // A new client replaces the demands' requesters and departments too.
      if (key === "clientId") {
        next.requesterIds = on
        next.departmentIds = on
      }
      return next
    })
    if (key === "clientId" && on) {
      setLists((prev) => ({ ...prev, requesterIds: { mode: "replace", ids: [] }, departmentIds: { mode: "replace", ids: [] } }))
    }
  }

  function setValue<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function setList(key: ListKey, change: Partial<BulkListChange>) {
    setLists((prev) => ({ ...prev, [key]: { ...prev[key], ...change } }))
  }

  function selectClient(clientId: string) {
    setValues((prev) => ({ ...prev, clientId, projectId: "", projectTaskId: "" }))
    setTasks([])
    setLists((prev) => ({ ...prev, requesterIds: { mode: "replace", ids: [] }, departmentIds: { mode: "replace", ids: [] } }))
  }

  async function selectProject(projectId: string) {
    setValues((prev) => ({ ...prev, projectId, projectTaskId: "" }))
    setTasks([])
    if (!projectId) return
    setLoadingTasks(true)
    setTasks(await listProjectTasksForDemand(projectId))
    setLoadingTasks(false)
  }

  function buildInput(): BulkUpdateDemandInput {
    const input: Record<string, unknown> = {}
    for (const key of ["name", "description", "notes", "date", "startTime", "endTime", "priority", "status", "clientId"] as const) {
      if (enabled[key]) input[key] = values[key]
    }
    if (enabled.project) {
      input.projectId = values.projectId
      input.projectTaskId = values.projectTaskId
    }
    for (const key of Object.keys(lists) as ListKey[]) {
      if (enabled[key]) input[key] = lists[key]
    }
    return input as BulkUpdateDemandInput
  }

  const anyEnabled = Object.values(enabled).some(Boolean)

  async function handleSave() {
    const parsed = bulkUpdateDemandSchema.safeParse(buildInput())
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos")
      return
    }
    setLoading(true)
    const result = await bulkUpdateDemands(
      rows.map((r) => r.id),
      parsed.data,
    )
    setLoading(false)
    if (!result.success) {
      toast.error(result.error || "Erro ao editar demandas")
      return
    }
    const failed = result.failed ?? []
    if (result.updatedCount) toast.success(`${result.updatedCount} demanda(s) atualizada(s)`)
    if (failed.length) {
      toast.error(`${failed.length} demanda(s) não foram atualizadas`, {
        description: (
          <ul className="list-disc space-y-1 pl-4">
            {failed.slice(0, 5).map((f) => (
              <li key={f.id}>
                <strong>{f.name}</strong>: {f.reason}
              </li>
            ))}
            {failed.length > 5 && <li>e mais {failed.length - 5}…</li>}
          </ul>
        ),
        duration: 10000,
      })
    }
    onSaved(failed.length === 0)
    if (failed.length === 0) onOpenChange(false)
  }

  function listField(key: ListKey, label: string, items: { value: string; label: string; color?: string }[], options: { disabledReason?: string; modes?: BulkListMode[] } = {}) {
    const modes = options.modes ?? (["add", "replace", "remove"] as BulkListMode[])
    return (
      <BulkField label={label} checked={!!enabled[key]} onCheckedChange={(on) => toggle(key, on)} locked={peopleLocked && (key === "requesterIds" || key === "departmentIds")} disabledReason={options.disabledReason}>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            items={modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
            value={lists[key].mode}
            onValueChange={(v) => v && setList(key, { mode: v as BulkListMode })}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modes.map((m) => (
                <SelectItem key={m} value={m}>
                  {MODE_LABELS[m]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <MultiSelect
            items={items}
            value={lists[key].ids}
            onValueChange={(ids) => setList(key, { ids })}
            placeholder={lists[key].mode === "replace" && key === "tagIds" ? "Nenhuma (limpa as tags)" : `Selecione ${label.toLowerCase()}`}
            searchPlaceholder="Buscar..."
            className="flex-1"
          />
        </div>
      </BulkField>
    )
  }

  const noClientReason = targetClientId ? undefined : "As demandas selecionadas são de clientes diferentes. Altere o cliente para editar este campo."

  return (
    <>
      <DialogHeader>
        <DialogTitle>Editar {rows.length} demanda(s)</DialogTitle>
      </DialogHeader>
      <DialogBody>
        <FieldDescription>Marque os campos que deseja alterar. Os demais ficam como estão em cada demanda.</FieldDescription>

        <BulkField label="Nome" checked={!!enabled.name} onCheckedChange={(on) => toggle("name", on)}>
          <Input value={values.name} onChange={(e) => setValue("name", e.target.value)} placeholder="Novo nome" />
        </BulkField>
        <BulkField label="Descrição" checked={!!enabled.description} onCheckedChange={(on) => toggle("description", on)}>
          <Textarea value={values.description} onChange={(e) => setValue("description", e.target.value)} placeholder="Nova descrição" />
        </BulkField>

        <BulkField label="Cliente" checked={!!enabled.clientId} onCheckedChange={(on) => toggle("clientId", on)}>
          <ClientSelect clients={clients} value={values.clientId} onValueChange={selectClient} />
          <FieldDescription>Ao trocar o cliente, solicitantes e departamentos são substituídos e o projeto de outro cliente é removido.</FieldDescription>
        </BulkField>
        {listField(
          "requesterIds",
          "Solicitantes",
          requesterOptions.map((r) => ({ value: r.id, label: r.name, color: r.color })),
          { disabledReason: noClientReason, modes: peopleLocked ? ["replace"] : undefined },
        )}
        {listField(
          "departmentIds",
          "Departamentos",
          departmentOptions.map((d) => ({ value: d.id, label: d.name, color: d.color })),
          { disabledReason: noClientReason, modes: peopleLocked ? ["replace"] : undefined },
        )}
        {listField("analystIds", "Analistas", analysts.map((a) => ({ value: a.id, label: a.name, color: a.color })))}
        {listField("demandTypeIds", "Tipos", demandTypes.map((t) => ({ value: t.id, label: t.name, color: t.color })))}

        <BulkField label="Projeto" checked={!!enabled.project} onCheckedChange={(on) => toggle("project", on)} disabledReason={noClientReason}>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Combobox
              items={[{ value: "", label: "Sem projeto" }, ...projectItems]}
              value={values.projectId}
              onValueChange={selectProject}
              placeholder="Sem projeto"
              searchPlaceholder="Buscar projeto..."
            />
            <Combobox
              items={[{ value: "", label: "Sem tarefa" }, ...tasks.map((t) => ({ value: t.id, label: `#${t.number} ${t.title}` }))]}
              value={values.projectTaskId}
              onValueChange={(v) => setValue("projectTaskId", v)}
              disabled={!values.projectId || loadingTasks}
              placeholder={loadingTasks ? "Carregando tarefas..." : "Sem tarefa"}
              searchPlaceholder="Buscar tarefa..."
            />
          </div>
        </BulkField>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <BulkField label="Data" checked={!!enabled.date} onCheckedChange={(on) => toggle("date", on)}>
            <DatePicker value={values.date} onValueChange={(v) => setValue("date", v)} />
          </BulkField>
          <BulkField label="Hora de início" checked={!!enabled.startTime} onCheckedChange={(on) => toggle("startTime", on)}>
            <TimePicker value={values.startTime} onValueChange={(v) => setValue("startTime", v)} />
          </BulkField>
          <BulkField label="Hora de término" checked={!!enabled.endTime} onCheckedChange={(on) => toggle("endTime", on)}>
            <TimePicker value={values.endTime} onValueChange={(v) => setValue("endTime", v)} />
          </BulkField>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <BulkField label="Prioridade" checked={!!enabled.priority} onCheckedChange={(on) => toggle("priority", on)}>
            <BadgeSelect labels={DEMAND_PRIORITY_LABELS} colors={DEMAND_PRIORITY_COLORS} value={values.priority} onValueChange={(v) => setValue("priority", v)} />
          </BulkField>
          <BulkField label="Status" checked={!!enabled.status} onCheckedChange={(on) => toggle("status", on)}>
            <BadgeSelect labels={DEMAND_STATUS_LABELS} colors={DEMAND_STATUS_COLORS} value={values.status} onValueChange={(v) => setValue("status", v)} />
          </BulkField>
        </div>

        {listField("tagIds", "Tags", tags.map((t) => ({ value: t.id, label: t.name, color: t.color })))}
        <BulkField label="Observações" checked={!!enabled.notes} onCheckedChange={(on) => toggle("notes", on)}>
          <Textarea value={values.notes} onChange={(e) => setValue("notes", e.target.value)} placeholder="Novas observações (vazio limpa)" />
        </BulkField>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancelar
        </Button>
        <Button type="button" onClick={handleSave} disabled={loading || !anyEnabled}>
          {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
          Aplicar
        </Button>
      </DialogFooter>
    </>
  )
}

/** One bulk-editable field: a checkbox turns it on, and only then its input shows. */
function BulkField({
  label,
  checked,
  onCheckedChange,
  locked,
  disabledReason,
  children,
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  /** Forced on by another field (e.g. requesters when the client changes). */
  locked?: boolean
  disabledReason?: string
  children: React.ReactNode
}) {
  const disabled = !!disabledReason && !locked
  return (
    <Field>
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium">
        <Checkbox checked={checked} onCheckedChange={(v) => onCheckedChange(!!v)} disabled={disabled || locked} />
        Alterar {label.toLowerCase()}
      </label>
      {disabled ? <FieldDescription>{disabledReason}</FieldDescription> : checked && children}
    </Field>
  )
}

function BadgeSelect({
  labels,
  colors,
  value,
  onValueChange,
}: {
  labels: Record<string, string>
  colors: Record<string, string>
  value: string
  onValueChange: (value: string) => void
}) {
  return (
    <Select items={Object.entries(labels).map(([v, label]) => ({ value: v, label }))} value={value} onValueChange={(v) => v && onValueChange(v)}>
      <SelectTrigger className="w-full">
        <SelectValue>{(v: string) => (v ? <ColorBadge label={labels[v]} color={colors[v]} /> : "Selecione")}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {Object.entries(labels).map(([v, label]) => (
          <SelectItem key={v} value={v}>
            <ColorBadge label={label} color={colors[v]} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
