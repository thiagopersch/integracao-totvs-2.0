"use client"

import { CheckCircle2, Loader2, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { AI_ENTITIES, isRef, recordTitle, type AiCatalogs, type AiFieldDef, type AiRecordProposal } from "@/lib/ai/entities"

export type ProposalState = AiRecordProposal & { key: string; created?: boolean; saving?: boolean; reported?: boolean; createdId?: string }

/** Combobox value standing for "no value" on optional references. */
const NONE = "__none__"

interface ProposalCardProps {
  proposal: ProposalState
  index: number
  catalogs: AiCatalogs
  /** Pending proposals of the batch — offered in reference fields as "(novo) ...". */
  batch: ProposalState[]
  /** Title of the pending proposal this one waits for, if any. */
  waitingFor: string | null
  busy: boolean
  onChange: (key: string, patch: Record<string, string>) => void
  onConfirm: (key: string) => void
  onDiscard: (key: string) => void
}

export function ProposalCard({ proposal: p, index, catalogs, batch, waitingFor, busy, onChange, onConfirm, onDiscard }: ProposalCardProps) {
  const def = AI_ENTITIES[p.entity]
  const hasErrors = Object.keys(p.errors).length > 0

  return (
    <div
      className={cn(
        "space-y-2 rounded-lg border p-3",
        p.created && "border-emerald-500/50 bg-emerald-500/5",
        !p.created && hasErrors && "border-amber-500/60"
      )}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        {p.created ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> : <span className="text-muted-foreground">#{index + 1}</span>}
        <Badge variant="secondary" className="shrink-0">
          {def.label}
        </Badge>
        <span className="truncate">{recordTitle(p.entity, p.values)}</span>
        {!p.created && (
          <div className="ml-auto flex shrink-0 gap-1">
            <Button
              size="sm"
              onClick={() => onConfirm(p.key)}
              disabled={p.saving || busy || hasErrors || !!waitingFor}
              title={waitingFor ? `Confirme "${waitingFor}" primeiro` : undefined}
            >
              {p.saving && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              Confirmar
            </Button>
            <Button size="icon-sm" variant="ghost" aria-label="Descartar" onClick={() => onDiscard(p.key)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
        {p.created && <span className="ml-auto shrink-0 text-xs text-emerald-700 dark:text-emerald-400">Criado</span>}
      </div>
      {!p.created && (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {def.fields.map((field) => (
            <FieldShell key={field.key} field={field} error={p.errors[field.key]}>
              <FieldInput
                field={field}
                values={p.values}
                catalogs={catalogs}
                batch={batch.filter((b) => b.key !== p.key)}
                onChange={(value) => onChange(p.key, { [field.key]: value })}
              />
            </FieldShell>
          ))}
          {waitingFor && <p className="text-xs text-muted-foreground sm:col-span-2">Confirme &quot;{waitingFor}&quot; primeiro.</p>}
          {p.errors._form && <p className="text-xs text-destructive sm:col-span-2">{p.errors._form}</p>}
        </div>
      )}
    </div>
  )
}

function FieldShell({ field, error, children }: { field: AiFieldDef; error?: string; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1", (field.wide || field.kind === "textarea") && "sm:col-span-2")}>
      <Label className={cn("text-xs", error && "text-destructive")}>
        {field.label}
        {field.required && " *"}
      </Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Catalog items allowed for a reference (filtered by its owner field) + pending proposals that create into the same catalog. */
export function refItems(field: AiFieldDef, values: Record<string, string>, catalogs: AiCatalogs, batch: ProposalState[]) {
  const parent = field.parentField ? values[field.parentField] ?? "" : ""
  const fromCatalog = (catalogs[field.ref!] ?? [])
    .filter((i) => !parent || i.parentId === undefined || (!isRef(parent) && i.parentId === parent))
    .map((i) => ({ value: i.id, label: i.name }))
  const fromBatch = batch
    .filter((b) => !b.created && AI_ENTITIES[b.entity].catalog === field.ref)
    .map((b) => ({ value: `@${b.tempId}`, label: `(novo) ${recordTitle(b.entity, b.values)}` }))
  return [...(field.required ? [] : [{ value: NONE, label: "— Nenhum —" }]), ...fromBatch, ...fromCatalog]
}

function FieldInput({
  field,
  values,
  catalogs,
  batch,
  onChange,
}: {
  field: AiFieldDef
  values: Record<string, string>
  catalogs: AiCatalogs
  batch: ProposalState[]
  onChange: (value: string) => void
}) {
  const value = values[field.key] ?? ""
  switch (field.kind) {
    case "ref":
      return (
        <Combobox
          items={refItems(field, values, catalogs, batch)}
          value={value}
          onValueChange={(v) => onChange(v === NONE ? "" : v)}
          placeholder="Selecione"
          searchPlaceholder={`Buscar ${field.label.toLowerCase()}...`}
        />
      )
    case "enum": {
      const items = [...(field.required ? [] : [{ value: NONE, label: "— Nenhum —" }]), ...(field.options ?? [])]
      return (
        <Select items={items} value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : String(v))}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
    }
    case "textarea":
      return <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} />
    case "bool":
      return (
        <div className="flex h-9 items-center">
          <Switch checked={value === "true"} onCheckedChange={(c) => onChange(c ? "true" : "false")} />
        </div>
      )
    case "color":
      return (
        <div className="flex gap-2">
          <Input type="color" className="h-9 w-11 p-1" value={value || "#6366f1"} onChange={(e) => onChange(e.target.value)} />
          <Input value={value} placeholder="padrão" onChange={(e) => onChange(e.target.value)} />
        </div>
      )
    case "number":
      return <Input inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    default:
      return <Input type={field.kind === "date" || field.kind === "time" ? field.kind : "text"} value={value} onChange={(e) => onChange(e.target.value)} />
  }
}
