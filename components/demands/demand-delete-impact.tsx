"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { ColorBadge } from "@/components/shared/color-badge"
import { getDemandDeleteImpact } from "@/actions/demands"
import type { DemandDeleteImpact as Impact } from "@/services/demand.service"

type ImpactItems = Impact["clients"]

/** Lists what the demands are linked to, inside the delete confirm dialog; it all disappears with them on confirm. */
export function DemandDeleteImpact({ ids }: { ids: string[] }) {
  const key = ids.join(",")
  const [state, setState] = useState<{ key: string; impact?: Impact; error?: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    getDemandDeleteImpact(key ? key.split(",") : []).then((result) => {
      if (cancelled) return
      setState(result.success ? { key, impact: result.data } : { key, error: result.error })
    })
    return () => {
      cancelled = true
    }
  }, [key])

  if (!state || state.key !== key) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando vínculos...
      </div>
    )
  }
  if (state.error || !state.impact) {
    return <p className="text-sm text-destructive">{state.error ?? "Não foi possível carregar os vínculos"}</p>
  }

  const impact = state.impact
  const groups: [string, ImpactItems][] = [
    ["Cliente", impact.clients],
    ["Projeto", impact.projects],
    ["Tarefa de projeto", impact.projectTasks],
    ["Analistas", impact.analysts],
    ["Solicitantes", impact.requesters],
    ["Setores", impact.departments],
    ["Tipos", impact.demandTypes],
    ["Tags", impact.tags],
  ]
  const counts: [string, number][] = [
    ["Comentários", impact.commentCount],
    ["Anexos", impact.attachmentCount],
  ]
  const visibleGroups = groups.filter(([, items]) => items.length > 0)
  const visibleCounts = counts.filter(([, count]) => count > 0)

  if (visibleGroups.length === 0 && visibleCounts.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum vínculo encontrado.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">
        {impact.demandCount > 1 ? `As ${impact.demandCount} demandas estão vinculadas a:` : "Esta demanda está vinculada a:"}
      </p>
      <dl className="max-h-72 space-y-2 overflow-y-auto rounded-md border p-3 text-sm">
        {visibleGroups.map(([label, items]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] items-start gap-2">
            <dt className="pt-0.5 text-muted-foreground">{label}</dt>
            <dd className="flex flex-wrap gap-1">
              {items.map((item) => (
                <ColorBadge key={item.id} label={item.name} color={item.color} />
              ))}
            </dd>
          </div>
        ))}
        {visibleCounts.map(([label, count]) => (
          <div key={label} className="grid grid-cols-[8rem_1fr] gap-2">
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
