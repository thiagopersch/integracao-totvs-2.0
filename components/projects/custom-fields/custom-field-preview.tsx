"use client"

import { useEffect, useMemo } from "react"
import { useForm, useWatch, type Resolver } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Check, Eye, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ColorBadge } from "@/components/shared/color-badge"
import { CustomFieldsFormSection, type PickerUser } from "@/components/projects/custom-fields/custom-field-input"
import { CustomFieldValueView } from "@/components/projects/custom-fields/custom-field-value"
import { cn } from "@/lib/utils"
import {
  buildCustomFieldsSchema,
  CUSTOM_FIELD_ENTITY_LABELS,
  MULTI_OPTION_TYPES,
  OPTION_FIELD_TYPES,
  parseConfig,
  type CustomFieldDef,
  type CustomFieldEntity,
  type CustomFieldOption,
  type CustomFieldType,
  type CustomFieldValue,
} from "@/lib/custom-fields"

const PREVIEW_ID = "preview"

/** The definitions page loads no users — the USER type previews with sample names. */
const SAMPLE_USERS: PickerUser[] = [
  { id: "sample-1", name: "Ana Souza (exemplo)" },
  { id: "sample-2", name: "Bruno Lima (exemplo)" },
  { id: "sample-3", name: "Carla Mendes (exemplo)" },
]
const SAMPLE_USERS_BY_ID = Object.fromEntries(SAMPLE_USERS.map((u) => [u.id, u.name]))

export type CustomFieldDraft = {
  entity?: string
  label?: string
  type?: string
  helpText?: string | null
  required?: boolean
  showInList?: boolean
  status?: boolean
  options?: { id: string; label?: string; color?: string | null }[]
  config?: unknown
}

type PreviewValues = { customFields: Record<string, CustomFieldValue> }

/** Turns the in-progress definition form values into the def the real inputs render. */
function toPreviewDef(draft: CustomFieldDraft): CustomFieldDef {
  const type = (draft.type || "TEXT") as CustomFieldType
  return {
    id: PREVIEW_ID,
    entity: (draft.entity || "PROJECT") as CustomFieldEntity,
    label: draft.label?.trim() || "Nome da propriedade",
    type,
    helpText: draft.helpText?.trim() || null,
    required: !!draft.required,
    options: OPTION_FIELD_TYPES.includes(type)
      ? (draft.options ?? []).map((o, i) => ({ id: o.id, label: o.label?.trim() || `Opção ${i + 1}`, color: o.color }))
      : null,
    config: parseConfig(draft.config),
    position: 0,
    showInList: !!draft.showInList,
    status: draft.status !== false,
  }
}

/** Live preview of a custom field definition: the real input, its validation and its list cell. */
export function CustomFieldPreview({ draft }: { draft: CustomFieldDraft }) {
  const def = toPreviewDef(draft)
  // A new type means a new value shape — remount to drop the previous test value.
  return <PreviewForm key={def.type} def={def} />
}

function PreviewForm({ def }: { def: CustomFieldDef }) {
  const rulesKey = JSON.stringify([def.required, def.config, def.options?.map((o) => o.id)])
  const schema = useMemo(
    () => z.object({ customFields: buildCustomFieldsSchema([def]) }),
    // `def` is rebuilt every render; the schema only depends on what rulesKey captures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def.type, rulesKey]
  )
  const form = useForm<PreviewValues>({
    mode: "onChange",
    resolver: zodResolver(schema) as Resolver<PreviewValues>,
    defaultValues: { customFields: {} },
  })
  const value = useWatch({ control: form.control, name: `customFields.${PREVIEW_ID}` }) as CustomFieldValue | undefined
  const { isDirty } = form.formState

  // Re-check the test value when a rule changes (min/max, required, options…).
  useEffect(() => {
    if (isDirty) void form.trigger()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema])

  const options = def.options ?? []
  const showOpenList = def.type === "SELECT" || def.type === "MULTISELECT"

  return (
    <div
      className="space-y-4"
      // Enter in a preview input must not submit the definition form around it.
      onKeyDown={(e) => {
        if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) e.preventDefault()
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Eye className="h-4 w-4 text-muted-foreground" /> Pré-visualização
          </p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline">Em {def.entity === "PROJECT" ? "Projetos" : "Tarefas"}</Badge>
            {!def.status && <Badge variant="destructive">Inativa — oculta nos formulários</Badge>}
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => form.reset({ customFields: {} })}
          disabled={!isDirty}
        >
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Limpar
        </Button>
      </div>

      <div className="space-y-3 rounded-md border bg-background p-3">
        <p className="text-xs text-muted-foreground">
          Formulário de {CUSTOM_FIELD_ENTITY_LABELS[def.entity].toLowerCase()} — teste o preenchimento, nada é salvo.
        </p>
        <div className="sm:[&>div]:grid-cols-1">
          <CustomFieldsFormSection control={form.control} defs={[def]} users={SAMPLE_USERS} />
        </div>
        {showOpenList && (
          <OpenOptionList
            options={options}
            multiple={MULTI_OPTION_TYPES.includes(def.type)}
            value={value}
            onToggle={(id) => {
              // Read the latest value (not the rendered one) so quick consecutive clicks don't drop a toggle.
              const current = selectedIds(form.getValues(`customFields.${PREVIEW_ID}`))
              const multiple = MULTI_OPTION_TYPES.includes(def.type)
              const next = multiple
                ? current.includes(id)
                  ? current.filter((x) => x !== id)
                  : [...current, id]
                : current.includes(id)
                  ? null
                  : id
              form.setValue(`customFields.${PREVIEW_ID}`, next, { shouldDirty: true, shouldValidate: true })
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Na listagem</p>
        {def.showInList ? (
          <div className="overflow-hidden rounded-md border bg-background text-sm">
            <div className="border-b bg-muted/50 px-3 py-2 text-xs font-medium">{def.label}</div>
            <div className="px-3 py-2">
              <CustomFieldValueView def={def} value={value} usersById={SAMPLE_USERS_BY_ID} />
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">Não aparece como coluna — ative “Coluna na listagem”.</p>
        )}
      </div>
    </div>
  )
}

function selectedIds(value: CustomFieldValue | undefined): string[] {
  return Array.isArray(value) ? value : typeof value === "string" && value ? [value] : []
}

/** Static, always-open copy of the dropdown so the options (and their colors) stay visible. */
function OpenOptionList({
  options,
  multiple,
  value,
  onToggle,
}: {
  options: CustomFieldOption[]
  multiple: boolean
  value: CustomFieldValue | undefined
  onToggle: (id: string) => void
}) {
  const selected = selectedIds(value)
  if (options.length === 0) {
    return <p className="text-xs text-muted-foreground">Adicione opções para vê-las aqui.</p>
  }
  return (
    <div className="rounded-md border p-1 shadow-sm" role="listbox" aria-multiselectable={multiple || undefined}>
      {options.map((o) => {
        const active = selected.includes(o.id)
        return (
          <button
            key={o.id}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onToggle(o.id)}
            className={cn(
              "flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent",
              active && "bg-accent/60"
            )}
          >
            <ColorBadge label={o.label} color={o.color || "#6b7280"} />
            {active && <Check className="h-4 w-4 shrink-0" />}
          </button>
        )
      })}
    </div>
  )
}
