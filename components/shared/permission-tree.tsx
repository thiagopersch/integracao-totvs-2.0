"use client"

import { useMemo, useState } from "react"
import { Collapsible } from "@base-ui/react/collapsible"
import { ChevronRight, Search, ListChecks, ListX, ChevronsDownUp, ChevronsUpDown } from "lucide-react"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type PermissionRow = { id: string; resource: string; resourceLabel: string; action: string; name: string; module: string }

interface ResourceGroup {
  resource: string
  label: string
  items: PermissionRow[]
}

interface ModuleGroup {
  module: string
  resources: ResourceGroup[]
  ids: string[]
}

interface PermissionTreeProps {
  permissions: PermissionRow[]
  selectedIds: string[]
  onTogglePermission: (id: string, checked: boolean) => void
  onToggleIds: (ids: string[], checked: boolean) => void
  onSelectAll: () => void
  onDeselectAll: () => void
}

function buildTree(permissions: PermissionRow[]): ModuleGroup[] {
  const moduleMap = new Map<string, Map<string, ResourceGroup>>()

  for (const p of permissions) {
    if (!moduleMap.has(p.module)) moduleMap.set(p.module, new Map())
    const resourceMap = moduleMap.get(p.module)!
    if (!resourceMap.has(p.resource)) resourceMap.set(p.resource, { resource: p.resource, label: p.resourceLabel, items: [] })
    resourceMap.get(p.resource)!.items.push(p)
  }

  return Array.from(moduleMap.entries()).map(([module, resourceMap]) => {
    const resources = Array.from(resourceMap.values())
    return { module, resources, ids: resources.flatMap((r) => r.items.map((i) => i.id)) }
  })
}

export function PermissionTree({
  permissions,
  selectedIds,
  onTogglePermission,
  onToggleIds,
  onSelectAll,
  onDeselectAll,
}: PermissionTreeProps) {
  const [search, setSearch] = useState("")
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({})
  const [expandedResources, setExpandedResources] = useState<Record<string, boolean>>({})

  const tree = useMemo(() => buildTree(permissions), [permissions])

  const filteredTree = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tree

    return tree
      .map((moduleGroup) => {
        const moduleMatches = moduleGroup.module.toLowerCase().includes(term)
        const resources = moduleGroup.resources
          .map((resourceGroup) => {
            const resourceMatches = moduleMatches || resourceGroup.label.toLowerCase().includes(term)
            const items = resourceGroup.items.filter(
              (p) => resourceMatches || p.name.toLowerCase().includes(term) || p.action.toLowerCase().includes(term)
            )
            return items.length > 0 ? { ...resourceGroup, items } : null
          })
          .filter((r): r is ResourceGroup => r !== null)
        return resources.length > 0 ? { ...moduleGroup, resources, ids: resources.flatMap((r) => r.items.map((i) => i.id)) } : null
      })
      .filter((m): m is ModuleGroup => m !== null)
  }, [tree, search])

  function expandAll() {
    setExpandedModules(Object.fromEntries(tree.map((m) => [m.module, true])))
    setExpandedResources(
      Object.fromEntries(tree.flatMap((m) => m.resources.map((r) => [`${m.module}::${r.resource}`, true])))
    )
  }

  function collapseAll() {
    setExpandedModules(Object.fromEntries(tree.map((m) => [m.module, false])))
    setExpandedResources(
      Object.fromEntries(tree.flatMap((m) => m.resources.map((r) => [`${m.module}::${r.resource}`, false])))
    )
  }

  const searching = !!search.trim()

  function isModuleExpanded(module: string) {
    return searching ? true : (expandedModules[module] ?? false)
  }

  function isResourceExpanded(module: string, resource: string) {
    return searching ? true : (expandedResources[`${module}::${resource}`] ?? false)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por grupo ou permissão..."
            className="pl-7"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Button type="button" variant="outline" size="sm" onClick={onSelectAll}>
            <ListChecks /> Marcar todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDeselectAll}>
            <ListX /> Desmarcar todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={expandAll}>
            <ChevronsUpDown /> Expandir todos
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={collapseAll}>
            <ChevronsDownUp /> Recolher todos
          </Button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto rounded-lg border p-2">
        {filteredTree.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma permissão encontrada</p>
        )}
        {filteredTree.map((moduleGroup) => {
          const allChecked = moduleGroup.ids.every((id) => selectedIds.includes(id))
          const someChecked = !allChecked && moduleGroup.ids.some((id) => selectedIds.includes(id))
          const open = isModuleExpanded(moduleGroup.module)

          return (
            <Collapsible.Root
              key={moduleGroup.module}
              open={open}
              onOpenChange={(value) => setExpandedModules((prev) => ({ ...prev, [moduleGroup.module]: value }))}
            >
              <div className="flex items-center gap-1.5 py-1">
                <Collapsible.Trigger render={<Button type="button" variant="ghost" size="icon-xs" />}>
                  <ChevronRight className={cn("transition-transform", open && "rotate-90")} />
                </Collapsible.Trigger>
                <Checkbox
                  id={`module-${moduleGroup.module}`}
                  checked={allChecked}
                  data-indeterminate={someChecked || undefined}
                  onCheckedChange={(v) => onToggleIds(moduleGroup.ids, !!v)}
                />
                <Label htmlFor={`module-${moduleGroup.module}`} className="cursor-pointer text-xs font-semibold uppercase text-muted-foreground">
                  {moduleGroup.module}
                </Label>
                <span className="text-xs text-muted-foreground">
                  ({moduleGroup.ids.filter((id) => selectedIds.includes(id)).length}/{moduleGroup.ids.length})
                </span>
              </div>
              <Collapsible.Panel className="space-y-0.5 pl-6">
                {moduleGroup.resources.map((resourceGroup) => {
                  const resourceIds = resourceGroup.items.map((p) => p.id)
                  const resourceAllChecked = resourceIds.every((id) => selectedIds.includes(id))
                  const resourceSomeChecked = !resourceAllChecked && resourceIds.some((id) => selectedIds.includes(id))
                  const resourceKey = `${moduleGroup.module}::${resourceGroup.resource}`
                  const resourceOpen = isResourceExpanded(moduleGroup.module, resourceGroup.resource)

                  return (
                    <Collapsible.Root
                      key={resourceKey}
                      open={resourceOpen}
                      onOpenChange={(value) => setExpandedResources((prev) => ({ ...prev, [resourceKey]: value }))}
                    >
                      <div className="flex items-center gap-1.5 py-1">
                        <Collapsible.Trigger render={<Button type="button" variant="ghost" size="icon-xs" />}>
                          <ChevronRight className={cn("transition-transform", resourceOpen && "rotate-90")} />
                        </Collapsible.Trigger>
                        <Checkbox
                          id={`resource-${resourceKey}`}
                          checked={resourceAllChecked}
                          data-indeterminate={resourceSomeChecked || undefined}
                          onCheckedChange={(v) => onToggleIds(resourceIds, !!v)}
                        />
                        <Label htmlFor={`resource-${resourceKey}`} className="cursor-pointer text-sm font-medium">
                          {resourceGroup.label}
                        </Label>
                        <span className="text-xs text-muted-foreground">
                          ({resourceIds.filter((id) => selectedIds.includes(id)).length}/{resourceIds.length})
                        </span>
                      </div>
                      <Collapsible.Panel className="grid grid-cols-1 gap-1.5 py-1 pl-9 md:grid-cols-2 lg:grid-cols-4">
                        {resourceGroup.items.map((p) => (
                          <div key={p.id} className="flex items-center gap-2">
                            <Checkbox
                              id={`perm-${p.id}`}
                              checked={selectedIds.includes(p.id)}
                              onCheckedChange={(v) => onTogglePermission(p.id, !!v)}
                            />
                            <Label htmlFor={`perm-${p.id}`} className="cursor-pointer text-sm font-normal">
                              {p.name}
                            </Label>
                          </div>
                        ))}
                      </Collapsible.Panel>
                    </Collapsible.Root>
                  )
                })}
              </Collapsible.Panel>
            </Collapsible.Root>
          )
        })}
      </div>
    </div>
  )
}
