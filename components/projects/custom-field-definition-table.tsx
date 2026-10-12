"use client"

import { useMemo, useState } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { useForm, type Resolver, type UseFormReturn } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, ListOrdered, Loader2, Plus, Trash2 } from "lucide-react"
import { DataTable } from "@/components/shared/data-table"
import { DataTableFilterPanel } from "@/components/shared/data-table-filter-panel"
import { PageHeader } from "@/components/shared/page-header"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EntityActionsCell } from "@/components/shared/entity-actions-cell"
import { createSelectColumn } from "@/components/shared/select-column"
import { ColorBadge } from "@/components/shared/color-badge"
import { CustomFieldPreview, type CustomFieldDraft } from "@/components/projects/custom-fields/custom-field-preview"
import { WithTooltip } from "@/components/shared/with-tooltip"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { DatePicker } from "@/components/ui/date-picker"
import { TimePicker } from "@/components/ui/time-picker"
import { CurrencyInput } from "@/components/ui/currency-input"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  bulkDeleteCustomFieldDefinitions,
  createCustomFieldDefinition,
  deleteCustomFieldDefinition,
  reorderCustomFieldDefinitions,
  setCustomFieldDefinitionStatus,
  updateCustomFieldDefinition,
} from "@/actions/custom-fields"
import {
  customFieldDefinitionSchema,
  type CustomFieldDefinitionFormValues,
  type CustomFieldDefinitionInput,
} from "@/schemas/custom-field.schema"
import {
  CONFIG_KEYS_BY_TYPE,
  CUSTOM_FIELD_ENTITY_LABELS,
  CUSTOM_FIELD_TYPE_LABELS,
  OPTION_FIELD_TYPES,
  type CustomFieldConfig,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomFieldOption,
  type CustomFieldType,
} from "@/lib/custom-fields"
import { useCrudTable } from "@/hooks/use-crud-table"
import { useHasPermission } from "@/hooks/use-permissions"
import { useUrlParams } from "@/hooks/use-url-params"
import type { PaginationMeta } from "@/types/common"

export type CustomFieldDefinitionRow = CustomFieldDef & { usageCount: number; createdAt: string | Date }

interface CustomFieldDefinitionTableProps {
  data: CustomFieldDefinitionRow[]
  meta: PaginationMeta
  /** Active definitions per entity, in form order — source for the "Ordenar campos" dialog. */
  orderLists: Record<CustomFieldEntity, CustomFieldDef[]>
}

const SORTABLE_COLUMNS = ["label", "entity", "type", "required", "showInList", "position", "status", "createdAt"]
const ENTITY_COLORS: Record<CustomFieldEntity, string> = { PROJECT: "#6366f1", TASK: "#0ea5e9" }
const OPTION_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#64748b"]

const EMPTY_FORM: CustomFieldDefinitionFormValues = {
  entity: "PROJECT",
  label: "",
  type: "TEXT",
  helpText: "",
  required: false,
  showInList: false,
  status: true,
  options: [],
  config: {},
}

function newOption(index: number): CustomFieldOption {
  return { id: crypto.randomUUID(), label: "", color: OPTION_COLORS[index % OPTION_COLORS.length] }
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex items-center gap-2 rounded-md border bg-background p-1.5 ${isDragging ? "z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-1 text-muted-foreground"
        aria-label="Arrastar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      {children}
    </div>
  )
}

function OptionsEditor({
  value,
  onChange,
  invalid,
}: {
  value: CustomFieldOption[]
  onChange: (options: CustomFieldOption[]) => void
  invalid?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const from = value.findIndex((o) => o.id === active.id)
    const to = value.findIndex((o) => o.id === over.id)
    onChange(arrayMove(value, from, to))
  }

  return (
    <div className={`space-y-2 rounded-md border p-2 ${invalid ? "border-destructive" : ""}`}>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={value.map((o) => o.id)} strategy={verticalListSortingStrategy}>
          {value.map((option, index) => (
            <SortableRow key={option.id} id={option.id}>
              <Input
                type="color"
                className="h-8 w-10 shrink-0 p-1"
                value={option.color || "#6366f1"}
                onChange={(e) => onChange(value.map((o, i) => (i === index ? { ...o, color: e.target.value } : o)))}
                aria-label="Cor da opção"
              />
              <Input
                className="h-8"
                value={option.label}
                placeholder={`Opção ${index + 1}`}
                onChange={(e) => onChange(value.map((o, i) => (i === index ? { ...o, label: e.target.value } : o)))}
              />
              <WithTooltip label="Remover opção">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </WithTooltip>
            </SortableRow>
          ))}
        </SortableContext>
      </DndContext>
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...value, newOption(value.length)])}>
        <Plus className="mr-1 h-4 w-4" /> Adicionar opção
      </Button>
    </div>
  )
}

type DefinitionForm = UseFormReturn<CustomFieldDefinitionFormValues, unknown, CustomFieldDefinitionInput>

/** "Validações" section: the rules that apply to the selected type (CONFIG_KEYS_BY_TYPE). */
function ValidationRules({ form, type }: { form: DefinitionForm; type: CustomFieldType }) {
  const keys = CONFIG_KEYS_BY_TYPE[type]
  if (keys.length === 0) return null
  const config = form.watch("config") ?? {}
  const errors = (form.formState.errors.config ?? {}) as Record<string, { message?: string } | undefined>
  const setConfig = (key: keyof CustomFieldConfig, value: unknown) =>
    form.setValue("config", { ...config, [key]: value }, { shouldValidate: true })
  const numberInput = (
    key: "minLength" | "maxLength" | "min" | "max" | "minSelected" | "maxSelected",
    label: string,
    step = "1"
  ) => (
    <Field key={key}>
      <FieldLabel htmlFor={`cfg-${key}`}>{label}</FieldLabel>
      {type === "CURRENCY" && (key === "min" || key === "max") ? (
        <CurrencyInput
          id={`cfg-${key}`}
          value={(config[key] as number | null | undefined) ?? null}
          onValueChange={(v) => setConfig(key, v)}
          aria-invalid={!!errors[key]}
        />
      ) : (
        <Input
          id={`cfg-${key}`}
          type="number"
          step={step}
          min={key === "min" || key === "max" ? undefined : 0}
          value={config[key] ?? ""}
          onChange={(e) => setConfig(key, e.target.value === "" ? null : Number(e.target.value))}
          placeholder="Sem limite"
          aria-invalid={!!errors[key]}
        />
      )}
      <FieldError errors={[errors[key]]} />
    </Field>
  )

  return (
    <div className="space-y-3 rounded-md border p-3">
      <div>
        <p className="text-sm font-medium">Validações</p>
        <p className="text-xs text-muted-foreground">
          Regras aplicadas ao preencher o campo nos formulários. Deixe em branco para não limitar.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {keys.includes("placeholder") && (
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="cfg-placeholder">Texto de exemplo (placeholder)</FieldLabel>
            <Input
              id="cfg-placeholder"
              value={config.placeholder ?? ""}
              onChange={(e) => setConfig("placeholder", e.target.value)}
            />
          </Field>
        )}
        {keys.includes("minLength") && numberInput("minLength", "Mínimo de caracteres")}
        {keys.includes("maxLength") && numberInput("maxLength", "Máximo de caracteres")}
        {keys.includes("min") && numberInput("min", "Valor mínimo", "any")}
        {keys.includes("max") && numberInput("max", "Valor máximo", "any")}
        {keys.includes("minSelected") && numberInput("minSelected", "Mínimo de opções marcadas")}
        {keys.includes("maxSelected") && numberInput("maxSelected", "Máximo de opções marcadas")}
        {keys.includes("minDate") && (
          <Field>
            <FieldLabel>Data mínima</FieldLabel>
            <DatePicker
              value={config.minDate ?? ""}
              onValueChange={(v) => setConfig("minDate", v)}
              aria-invalid={!!errors.minDate}
            />
            <FieldError errors={[errors.minDate]} />
          </Field>
        )}
        {keys.includes("maxDate") && (
          <Field>
            <FieldLabel>Data máxima</FieldLabel>
            <DatePicker
              value={config.maxDate ?? ""}
              onValueChange={(v) => setConfig("maxDate", v)}
              aria-invalid={!!errors.maxDate}
            />
            <FieldError errors={[errors.maxDate]} />
          </Field>
        )}
        {keys.includes("minTime") && (
          <Field>
            <FieldLabel>Hora mínima</FieldLabel>
            <TimePicker
              value={config.minTime ?? ""}
              onValueChange={(v) => setConfig("minTime", v)}
              aria-invalid={!!errors.minTime}
            />
            <FieldError errors={[errors.minTime]} />
          </Field>
        )}
        {keys.includes("maxTime") && (
          <Field>
            <FieldLabel>Hora máxima</FieldLabel>
            <TimePicker
              value={config.maxTime ?? ""}
              onValueChange={(v) => setConfig("maxTime", v)}
              aria-invalid={!!errors.maxTime}
            />
            <FieldError errors={[errors.maxTime]} />
          </Field>
        )}
        {keys.includes("integer") && (
          <Field orientation="horizontal" className="sm:col-span-2">
            <Switch id="cfg-integer" checked={!!config.integer} onCheckedChange={(c) => setConfig("integer", c)} />
            <FieldLabel htmlFor="cfg-integer">Somente números inteiros</FieldLabel>
          </Field>
        )}
      </div>
    </div>
  )
}

function ReorderDialog({ orderLists }: { orderLists: Record<CustomFieldEntity, CustomFieldDef[]> }) {
  const { refresh } = useUrlParams()
  const [open, setOpen] = useState(false)
  const [entity, setEntity] = useState<CustomFieldEntity>("PROJECT")
  const [items, setItems] = useState<CustomFieldDef[]>(orderLists.PROJECT)
  const [saving, setSaving] = useState(false)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  function selectEntity(next: CustomFieldEntity) {
    setEntity(next)
    setItems(orderLists[next])
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    setItems((prev) =>
      arrayMove(
        prev,
        prev.findIndex((d) => d.id === active.id),
        prev.findIndex((d) => d.id === over.id)
      )
    )
  }

  async function save() {
    setSaving(true)
    const result = await reorderCustomFieldDefinitions({ entity, ids: items.map((d) => d.id) })
    setSaving(false)
    if (result.success) {
      toast.success("Ordem das propriedades salva")
      setOpen(false)
      refresh()
    } else toast.error(result.error || "Erro ao salvar ordem")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) selectEntity(entity)
      }}
    >
      <DialogTrigger
        render={
          <Button variant="outline">
            <ListOrdered className="mr-2 h-4 w-4" /> Ordenar propriedades
          </Button>
        }
      />
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ordem das propriedades no formulário</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <Field>
            <FieldLabel>Entidade</FieldLabel>
            <Select
              items={Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
              value={entity}
              onValueChange={(v) => v && selectEntity(v as CustomFieldEntity)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma propriedade ativa para esta entidade.</p>
          ) : (
            <div className="space-y-1.5">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map((d) => d.id)} strategy={verticalListSortingStrategy}>
                  {items.map((d) => (
                    <SortableRow key={d.id} id={d.id}>
                      <span className="flex-1 truncate text-sm">{d.label}</span>
                      <span className="text-xs text-muted-foreground">{CUSTOM_FIELD_TYPE_LABELS[d.type]}</span>
                    </SortableRow>
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={save} disabled={saving || items.length === 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CustomFieldDefinitionTable({ data, meta, orderLists }: CustomFieldDefinitionTableProps) {
  const {
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    refresh,
    isPending,
    handleDelete,
    handleToggleStatus,
    sort,
    onSortChange,
  } = useCrudTable<CustomFieldDefinitionRow>({
    deleteAction: deleteCustomFieldDefinition,
    setStatusAction: setCustomFieldDefinitionStatus,
    deleteSuccessMessage: "Propriedade excluída com sucesso",
    defaultSort: { field: "position", direction: "asc" },
  })
  const canCreate = useHasPermission("project_custom_fields", "create")
  const canUpdate = useHasPermission("project_custom_fields", "update")
  const canDelete = useHasPermission("project_custom_fields", "delete")
  const [loading, setLoading] = useState(false)
  const [entityFilter, setEntityFilter] = useState(searchParams.get("entity") || "")
  const [typeFilter, setTypeFilter] = useState(searchParams.get("type") || "")
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "")

  const editing = editDialog.entity
  const form = useForm<CustomFieldDefinitionFormValues, unknown, CustomFieldDefinitionInput>({
    mode: "onChange",
    resolver: zodResolver(customFieldDefinitionSchema) as Resolver<
      CustomFieldDefinitionFormValues,
      unknown,
      CustomFieldDefinitionInput
    >,
    values: editing
      ? {
          entity: editing.entity,
          label: editing.label,
          type: editing.type,
          helpText: editing.helpText || "",
          required: editing.required,
          showInList: editing.showInList,
          status: editing.status,
          options: editing.options ?? [],
          config: editing.config ?? {},
        }
      : EMPTY_FORM,
  })
  const type = form.watch("type") as CustomFieldType
  const hasOptions = OPTION_FIELD_TYPES.includes(type)
  const lockedType = !!editing && editing.usageCount > 0

  async function onSubmit(values: CustomFieldDefinitionInput) {
    setLoading(true)
    const result = editing
      ? await updateCustomFieldDefinition(editing.id, values)
      : await createCustomFieldDefinition(values)
    setLoading(false)
    if (result.success) {
      toast.success(editing ? "Propriedade atualizada" : "Propriedade criada")
      form.reset(EMPTY_FORM)
      setEditDialog({ open: false })
      refresh()
    } else {
      toast.error(result.error || "Erro ao salvar")
    }
  }

  const columns: ColumnDef<CustomFieldDefinitionRow>[] = useMemo(() => {
    const cols: ColumnDef<CustomFieldDefinitionRow>[] = [
      createSelectColumn<CustomFieldDefinitionRow>(),
      {
        accessorKey: "label",
        header: "Propriedade",
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">
              {row.original.label}
              {row.original.required && <span className="ml-0.5 text-destructive">*</span>}
            </span>
            {row.original.helpText && <span className="text-xs text-muted-foreground">{row.original.helpText}</span>}
          </div>
        ),
      },
      {
        accessorKey: "entity",
        header: "Entidade",
        cell: ({ row }) => (
          <ColorBadge
            label={CUSTOM_FIELD_ENTITY_LABELS[row.original.entity]}
            color={ENTITY_COLORS[row.original.entity]}
          />
        ),
      },
      {
        accessorKey: "type",
        header: "Tipo",
        cell: ({ row }) => CUSTOM_FIELD_TYPE_LABELS[row.original.type],
      },
      {
        id: "options",
        header: "Opções",
        cell: ({ row }) =>
          row.original.options?.length ? (
            <div className="flex max-w-xs flex-wrap gap-1">
              {row.original.options.slice(0, 4).map((o) => (
                <ColorBadge key={o.id} label={o.label} color={o.color || "#6b7280"} />
              ))}
              {row.original.options.length > 4 && (
                <span className="text-xs text-muted-foreground">+{row.original.options.length - 4}</span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "required",
        header: "Obrigatório",
        cell: ({ row }) => (row.original.required ? "Sim" : "Não"),
      },
      {
        accessorKey: "showInList",
        header: "Na listagem",
        cell: ({ row }) => (row.original.showInList ? "Sim" : "Não"),
      },
      {
        id: "usageCount",
        header: "Em uso",
        cell: ({ row }) => `${row.original.usageCount} registro(s)`,
      },
      {
        accessorKey: "position",
        header: "Ordem",
        cell: ({ row }) => row.original.position + 1,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <ColorBadge
            label={row.original.status ? "Ativo" : "Inativo"}
            color={row.original.status ? "#22c55e" : "#6b7280"}
          />
        ),
      },
    ]
    if (canUpdate || canDelete) {
      cols.push({
        id: "actions",
        cell: ({ row }) => (
          <EntityActionsCell
            onToggleStatus={canUpdate ? () => handleToggleStatus(row.original.id, row.original.status) : undefined}
            isActive={row.original.status}
            onEdit={canUpdate ? () => setEditDialog({ open: true, entity: row.original }) : undefined}
            onDelete={canDelete ? () => setDeleteDialog({ open: true, id: row.original.id }) : undefined}
          />
        ),
      })
    }
    return cols
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUpdate, canDelete])

  const formDialog = (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        setEditDialog({ open, entity: open ? editDialog.entity : undefined })
        if (!open) form.reset(EMPTY_FORM)
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Plus className="mr-2 h-4 w-4" /> Nova Propriedade
          </Button>
        }
      />
      <DialogContent className="sm:max-w-lg lg:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Editar Propriedade" : "Nova Propriedade"}</DialogTitle>
        </DialogHeader>
        <form
          onSubmit={form.handleSubmit(onSubmit, (errors) =>
            toast.error(
              (errors.options as { message?: string } | undefined)?.message ||
                (Object.values(errors.config ?? {}) as ({ message?: string } | undefined)[]).find((e) => e?.message)
                  ?.message ||
                "Verifique os campos destacados"
            )
          )}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogBody className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6 lg:space-y-0">
            <div className="min-w-0 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field>
                  <FieldLabel>Aplica-se a</FieldLabel>
                  <Select
                    items={Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => ({ value, label }))}
                    value={form.watch("entity")}
                    onValueChange={(v) =>
                      v && form.setValue("entity", v as CustomFieldEntity, { shouldValidate: true })
                    }
                    disabled={lockedType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel>Tipo</FieldLabel>
                  <Select
                    items={Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
                    value={type}
                    onValueChange={(v) => {
                      if (!v) return
                      form.setValue("type", v as CustomFieldType, { shouldValidate: true })
                      // Options/rules only belong to some types — reset them so leftovers of the
                      // previous type never block saving.
                      form.setValue("config", {})
                      if (!OPTION_FIELD_TYPES.includes(v as CustomFieldType)) form.setValue("options", [])
                      else if (!(form.getValues("options") ?? []).length)
                        form.setValue("options", [newOption(0), newOption(1)])
                      form.clearErrors(["options", "config"])
                    }}
                    disabled={lockedType}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              {lockedType && (
                <FieldDescription>
                  Tipo e entidade não podem ser alterados: a propriedade já tem valor em {editing?.usageCount}{" "}
                  registro(s).
                </FieldDescription>
              )}
              <Field>
                <FieldLabel htmlFor="label">Nome da propriedade</FieldLabel>
                <Input
                  id="label"
                  {...form.register("label")}
                  placeholder="Ex.: Centro de custo"
                  aria-invalid={!!form.formState.errors.label}
                />
                <FieldError errors={[form.formState.errors.label]} />
              </Field>
              <Field>
                <FieldLabel htmlFor="helpText">Texto de ajuda (opcional)</FieldLabel>
                <Input
                  id="helpText"
                  {...form.register("helpText")}
                  placeholder="Exibido abaixo do campo no formulário"
                />
                <FieldError errors={[form.formState.errors.helpText]} />
              </Field>
              {hasOptions && (
                <Field>
                  <FieldLabel>Opções</FieldLabel>
                  <OptionsEditor
                    value={(form.watch("options") ?? []) as CustomFieldOption[]}
                    onChange={(options) => form.setValue("options", options, { shouldValidate: true })}
                    invalid={!!form.formState.errors.options}
                  />
                  <FieldError errors={[form.formState.errors.options as { message?: string } | undefined]} />
                </Field>
              )}
              <ValidationRules form={form} type={type} />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field orientation="horizontal">
                  <Switch
                    id="required"
                    checked={!!form.watch("required")}
                    onCheckedChange={(c) => form.setValue("required", c)}
                  />
                  <FieldLabel htmlFor="required">
                    {type === "CHECKBOX" ? "Obrigatório marcar" : "Obrigatório"}
                  </FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    id="showInList"
                    checked={!!form.watch("showInList")}
                    onCheckedChange={(c) => form.setValue("showInList", c)}
                  />
                  <FieldLabel htmlFor="showInList">Coluna na listagem</FieldLabel>
                </Field>
                <Field orientation="horizontal">
                  <Switch
                    id="status"
                    checked={!!form.watch("status")}
                    onCheckedChange={(c) => form.setValue("status", c)}
                  />
                  <FieldLabel htmlFor="status">Ativo</FieldLabel>
                </Field>
              </div>
            </div>
            <aside className="mt-4 rounded-lg border bg-muted/30 p-4 lg:sticky lg:top-0 lg:mt-0 lg:self-start">
              <CustomFieldPreview draft={form.watch() as CustomFieldDraft} />
            </aside>
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDialog({ open: false })} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  const filterPanel = (
    <DataTableFilterPanel
      onApply={() =>
        pushParams({
          entity: entityFilter || undefined,
          type: typeFilter || undefined,
          status: statusFilter || undefined,
          page: 1,
        })
      }
      onClear={() => {
        setEntityFilter("")
        setTypeFilter("")
        setStatusFilter("")
        pushParams({ entity: undefined, type: undefined, status: undefined, page: 1 })
      }}
    >
      <div className="space-y-2">
        <Label>Entidade</Label>
        <Select
          items={[
            { value: "all", label: "Todas" },
            ...Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={entityFilter || "all"}
          onValueChange={(v) => setEntityFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {Object.entries(CUSTOM_FIELD_ENTITY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            ...Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => ({ value, label })),
          ]}
          value={typeFilter || "all"}
          onValueChange={(v) => setTypeFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {Object.entries(CUSTOM_FIELD_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select
          items={[
            { value: "all", label: "Todos" },
            { value: "true", label: "Ativo" },
            { value: "false", label: "Inativo" },
          ]}
          value={statusFilter || "all"}
          onValueChange={(v) => setStatusFilter(!v || v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </DataTableFilterPanel>
  )

  return (
    <>
      <PageHeader
        title="Propriedades"
        description="Propriedades complementares de Projetos e Tarefas — criadas aqui, sem alterar o banco de dados"
      >
        {canUpdate && <ReorderDialog orderLists={orderLists} />}
      </PageHeader>

      <DataTable
        refreshing={isPending}
        columns={columns}
        data={data}
        page={meta.page}
        pageSize={meta.pageSize}
        total={meta.total}
        pageCount={meta.totalPages}
        onPageChange={(p) => pushParams({ page: p })}
        onPageSizeChange={(ps) => pushParams({ pageSize: ps, page: 1 })}
        searchPlaceholder="Buscar propriedade..."
        onSearch={(v) => pushParams({ search: v || undefined, page: 1 })}
        toolbarActions={canCreate ? formDialog : undefined}
        filterPanel={filterPanel}
        sort={sort}
        onSortChange={onSortChange}
        sortableColumns={SORTABLE_COLUMNS}
        bulkDelete={
          canDelete
            ? {
                getId: (row) => row.id,
                getRowLabel: (row) => row.label,
                action: bulkDeleteCustomFieldDefinitions,
                confirmDescription: (count) =>
                  `Excluir ${count} propriedade(s)? Propriedades com valores preenchidos não serão excluídas — desative-as.`,
                onSuccess: () => refresh(),
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, id: deleteDialog.id })}
        title="Excluir Propriedade"
        description="Tem certeza que deseja excluir esta propriedade? Propriedades com valores preenchidos não podem ser excluídas — desative-as."
        confirmLabel="Excluir"
        variant="destructive"
        onConfirm={() => deleteDialog.id && handleDelete(deleteDialog.id)}
      />
    </>
  )
}
