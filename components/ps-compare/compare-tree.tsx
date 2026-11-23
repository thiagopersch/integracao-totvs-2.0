"use client"

import { Button } from "@/components/ui/button"
import type { CompareNode } from "@/lib/ps-compare/types"
import { ChevronDown, ChevronRight } from "lucide-react"
import { useState } from "react"
import { StatusBadge, StatusIcon } from "./status-badge"

const dash = (v: string) => v || "—"

function DiffTable({ node }: { node: CompareNode }) {
  if (node.status === "so_a" || node.status === "so_b")
    return <p className="text-sm text-muted-foreground">Este elemento existe somente {node.status === "so_a" ? "no PS A" : "no PS B"}.</p>
  if (node.diffs.length === 0) return <p className="text-sm text-muted-foreground">Todas as {node.propCount} propriedade(s) estão iguais.</p>
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left">
          <tr>
            <th className="w-1/4 p-2 font-medium">Propriedade</th>
            <th className="p-2 font-medium">PS A</th>
            <th className="p-2 font-medium">PS B</th>
          </tr>
        </thead>
        <tbody>
          {node.diffs.map((d) => (
            <tr key={d.prop} className="border-t align-top">
              <td className="p-2 font-medium">{d.label}</td>
              <td className="p-2 break-words whitespace-pre-wrap">{dash(d.a)}</td>
              <td className="p-2 break-words whitespace-pre-wrap">{dash(d.b)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function TreeNode({ node, depth, expanded, toggle, onlyDifferences }: { node: CompareNode; depth: number; expanded: Set<string>; toggle: (id: string) => void; onlyDifferences: boolean }) {
  const open = expanded.has(node.id)
  const children = onlyDifferences ? node.children.filter((c) => c.hasDifference) : node.children
  return (
    <li>
      <button
        type="button"
        onClick={() => toggle(node.id)}
        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted/60"
        style={{ paddingLeft: `${depth * 1.25 + 0.5}rem` }}
        aria-expanded={open}
      >
        {open ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
        <StatusIcon status={node.status} />
        <span className="shrink-0 text-xs text-muted-foreground uppercase">{node.tipo}</span>
        <span className="truncate font-medium">{node.label}</span>
        {node.status === "diferente" && <span className="shrink-0 text-xs text-muted-foreground">{node.diffs.length} diferença(s)</span>}
        {node.status === "igual" && node.hasDifference && <span className="shrink-0 text-xs text-muted-foreground">diferenças internas</span>}
        <span className="ml-auto shrink-0">
          <StatusBadge status={node.status} />
        </span>
      </button>
      {open && (
        <div className="space-y-2 py-2" style={{ paddingLeft: `${depth * 1.25 + 2.25}rem` }}>
          <DiffTable node={node} />
        </div>
      )}
      {open && children.length > 0 && (
        <ul>
          {children.map((c) => (
            <TreeNode key={c.id} node={c} depth={depth + 1} expanded={expanded} toggle={toggle} onlyDifferences={onlyDifferences} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** Etapa → Passo → Itens (→ filhos), each node expandable to its A × B property table. */
export function CompareTree({ nodes, onlyDifferences }: { nodes: CompareNode[]; onlyDifferences: boolean }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const expandDifferences = () => {
    const ids = new Set<string>()
    const visit = (list: CompareNode[]) => list.forEach((n) => n.hasDifference && (ids.add(n.id), visit(n.children)))
    visit(nodes)
    setExpanded(ids)
  }
  const roots = onlyDifferences ? nodes.filter((n) => n.hasDifference) : nodes

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={expandDifferences}>
          Expandir diferenças
        </Button>
        <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          Recolher tudo
        </Button>
      </div>
      {roots.length === 0 ? (
        <p className="p-4 text-center text-sm text-muted-foreground">Nenhuma diferença encontrada — os dois processos estão iguais.</p>
      ) : (
        <ul className="rounded-md border p-1">
          {roots.map((n) => (
            <TreeNode key={n.id} node={n} depth={0} expanded={expanded} toggle={toggle} onlyDifferences={onlyDifferences} />
          ))}
        </ul>
      )}
    </div>
  )
}
