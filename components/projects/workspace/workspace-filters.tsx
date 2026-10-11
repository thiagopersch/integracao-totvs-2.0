"use client"

import { Filter, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { MultiSelect } from "@/components/ui/multi-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { OptionSelect } from "@/components/projects/option-select"
import { CUSTOM_FIELD_PARAM_PREFIX, type CustomFieldDef } from "@/lib/custom-fields"
import { countActiveFilters, filterParamKeys, type Swimlane, type TaskFilters, type WorkspaceView } from "@/lib/project-workspace-params"
import { PRIORITIES, PRIORITY_COLORS, PRIORITY_LABELS, TASK_STATUSES, TASK_STATUS_COLORS, TASK_STATUS_LABELS } from "@/lib/projects"
import type { ParamUpdates } from "@/hooks/use-url-params"
import type { TaskOptions, TeamMember } from "@/components/projects/workspace/types"

const FILTERABLE_TYPES = new Set(["SELECT", "MULTISELECT", "BOOLEAN", "USER", "TEXT"])

interface WorkspaceFiltersProps {
  view: WorkspaceView
  filters: TaskFilters
  swimlane: Swimlane
  team: TeamMember[]
  tags: TaskOptions["tags"]
  defs: CustomFieldDef[]
  usersById: Record<string, string>
  pushParams: (updates: ParamUpdates) => void
}

export function WorkspaceFilters({ view, filters, swimlane, team, tags, defs, usersById, pushParams }: WorkspaceFiltersProps) {
  const active = countActiveFilters(filters)
  const cfDefs = defs.filter((d) => FILTERABLE_TYPES.has(d.type))
  const cfKeys = cfDefs.map((d) => `${CUSTOM_FIELD_PARAM_PREFIX}${d.id}`)
  const set = (updates: ParamUpdates) => pushParams({ ...updates, page: undefined })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <form
        className="relative w-full sm:w-64"
        onSubmit={(e) => {
          e.preventDefault()
          const value = String(new FormData(e.currentTarget).get("q") ?? "").trim()
          set({ q: value || undefined })
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          key={filters.q ?? ""}
          name="q"
          defaultValue={filters.q ?? ""}
          onBlur={(e) => e.target.value.trim() !== (filters.q ?? "") && set({ q: e.target.value.trim() || undefined })}
          placeholder="Buscar tarefa ou nº"
          className="pl-8"
        />
      </form>
      <div className="w-44">
        <OptionSelect
          options={[
            { value: "me", label: "Minhas tarefas" },
            { value: "none", label: "Sem responsável" },
            ...team.map((m) => ({ value: m.id, label: m.name })),
          ]}
          value={filters.assignee}
          onChange={(v) => set({ assignee: v || undefined })}
          emptyLabel="Todos os responsáveis"
        />
      </div>
      <div className="w-48">
        <MultiSelect
          items={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABELS[s], color: TASK_STATUS_COLORS[s] }))}
          value={filters.status}
          onValueChange={(v) => set({ status: v.join(",") || undefined })}
          placeholder="Status"
        />
      </div>
      <div className="w-40">
        <OptionSelect
          options={[
            { value: "overdue", label: "Atrasadas" },
            { value: "week", label: "Próximos 7 dias" },
            { value: "none", label: "Sem prazo" },
          ]}
          value={filters.due}
          onChange={(v) => set({ due: v || undefined })}
          emptyLabel="Qualquer prazo"
        />
      </div>
      {view === "kanban" && (
        <div className="w-44">
          <OptionSelect
            options={[
              { value: "assignee", label: "Raias por responsável" },
              { value: "priority", label: "Raias por prioridade" },
            ]}
            value={swimlane === "none" ? "" : swimlane}
            onChange={(v) => pushParams({ swimlane: v || undefined })}
            emptyLabel="Sem raias"
          />
        </div>
      )}

      <Popover>
        <PopoverTrigger render={<Button variant="outline" size="sm" className="h-9" />}>
          <Filter className="mr-1.5 h-4 w-4" /> Mais filtros
        </PopoverTrigger>
        <PopoverContent className="w-80 space-y-3" align="start">
          <div className="space-y-1.5">
            <Label>Prioridade</Label>
            <MultiSelect
              items={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABELS[p], color: PRIORITY_COLORS[p] }))}
              value={filters.priority}
              onValueChange={(v) => set({ priority: v.join(",") || undefined })}
              placeholder="Todas"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tag</Label>
            <OptionSelect options={tags.map((t) => ({ value: t.id, label: t.name, color: t.color }))} value={filters.tag} onChange={(v) => set({ tag: v || undefined })} emptyLabel="Todas" />
          </div>
          {cfDefs.map((def) => {
            const key = `${CUSTOM_FIELD_PARAM_PREFIX}${def.id}`
            const value = filters.customFields[key]
            return (
              <div key={def.id} className="space-y-1.5">
                <Label>{def.label}</Label>
                {def.type === "TEXT" ? (
                  <Input defaultValue={value ?? ""} placeholder="Contém..." onBlur={(e) => e.target.value !== (value ?? "") && set({ [key]: e.target.value || undefined })} />
                ) : (
                  <OptionSelect
                    options={
                      def.type === "BOOLEAN"
                        ? [{ value: "true", label: "Sim" }, { value: "false", label: "Não" }]
                        : def.type === "USER"
                          ? Object.entries(usersById).map(([id, name]) => ({ value: id, label: name }))
                          : (def.options ?? []).map((o) => ({ value: o.id, label: o.label, color: o.color || undefined }))
                    }
                    value={value}
                    onChange={(v) => set({ [key]: v || undefined })}
                    emptyLabel="Todos"
                  />
                )}
              </div>
            )
          })}
          <div className="flex items-center gap-2 pt-1">
            <Switch id="show-cancelled" checked={filters.showCancelled} onCheckedChange={(c) => set({ cancelled: c ? "1" : undefined })} />
            <Label htmlFor="show-cancelled">Mostrar canceladas</Label>
          </div>
        </PopoverContent>
      </Popover>

      {active > 0 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9"
          onClick={() => set(Object.fromEntries(filterParamKeys(cfKeys).map((k) => [k, undefined])))}
        >
          <X className="mr-1 h-4 w-4" /> Limpar ({active})
        </Button>
      )}
    </div>
  )
}
