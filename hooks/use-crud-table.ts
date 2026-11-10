"use client"

import { useCallback, useState } from "react"
import { toast } from "@/lib/toast"
import { useUrlParams } from "@/hooks/use-url-params"

type ActionResult = { success: boolean; error?: string }
export type SortState = { field: string; direction: "asc" | "desc" }

interface UseCrudTableOptions {
  deleteAction: (id: string) => Promise<ActionResult>
  restoreAction?: (id: string) => Promise<ActionResult>
  /** Flips the Ativado/Desativado flag directly from the row actions menu. */
  setStatusAction?: (id: string, status: boolean) => Promise<ActionResult>
  deleteSuccessMessage: string
  deleteErrorMessage?: string
  restoreSuccessMessage?: string
  restoreErrorMessage?: string
  /** Sort applied when the URL has no `sort` param yet. */
  defaultSort?: SortState
  /** Row field holding the Ativado/Desativado flag (default "status"). */
  statusKey?: string
}

/** A change shown before the server confirms it. `from` is the status the row had when toggled. */
type Patch = { kind: "status"; from: boolean } | { kind: "removed" }

export function useCrudTable<TEntity>(options: UseCrudTableOptions) {
  // Every navigation/refresh runs in a transition so the table can show its own pending state
  // (DataTable `refreshing`) instead of the page freezing or being swapped for a skeleton.
  const { router, searchParams, isPending, pushParams, refresh } = useUrlParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; entity?: TEntity }>({ open: false })
  const [patches, setPatches] = useState<Record<string, Patch>>({})
  const statusKey = options.statusKey ?? "status"

  const setPatch = useCallback((id: string, patch: Patch | null) => {
    setPatches((prev) => {
      const next = { ...prev }
      if (patch) next[id] = patch
      else delete next[id]
      return next
    })
  }, [])

  /**
   * The rows as the user expects them right now: toggled statuses flipped and deleted rows gone
   * while the server works. A status patch stops applying by itself once the refreshed row already
   * carries the new value; failed actions drop their patch and the row snaps back.
   */
  function optimisticRows<TRow extends { id: string }>(rows: TRow[]): TRow[] {
    if (!Object.keys(patches).length) return rows
    const result: TRow[] = []
    for (const row of rows) {
      const patch = patches[row.id]
      if (!patch) result.push(row)
      else if (patch.kind === "removed") continue
      else {
        const current = (row as Record<string, unknown>)[statusKey]
        result.push(current === patch.from ? ({ ...row, [statusKey]: !patch.from } as TRow) : row)
      }
    }
    return result
  }

  const sortParam = searchParams.get("sort")
  const sort: SortState | undefined = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : options.defaultSort

  function onSortChange(next: SortState) {
    pushParams({ sort: `${next.field}:${next.direction}`, page: 1 })
  }

  async function handleDelete(id: string) {
    // Optimistic: the row leaves the table right away; it comes back if the server refuses.
    setPatch(id, { kind: "removed" })
    setDeleteDialog({ open: false })
    const result = await options.deleteAction(id)
    if (result.success) {
      toast.success(options.deleteSuccessMessage)
      refresh()
    } else {
      setPatch(id, null)
      toast.error(result.error || options.deleteErrorMessage || "Erro ao excluir")
    }
  }

  async function handleRestore(id: string) {
    if (!options.restoreAction) return
    setPatch(id, null)
    const result = await options.restoreAction(id)
    if (result.success) {
      toast.success(options.restoreSuccessMessage || "Restaurado com sucesso")
      refresh()
    } else {
      toast.error(result.error || options.restoreErrorMessage || "Erro ao restaurar")
    }
  }

  async function handleToggleStatus(id: string, currentStatus: boolean) {
    if (!options.setStatusAction) return
    const nextStatus = !currentStatus
    // Optimistic: the switch/badge flips immediately; reverted with the server's reason on failure.
    setPatch(id, { kind: "status", from: currentStatus })
    const result = await options.setStatusAction(id, nextStatus)
    if (result.success) {
      toast.success(nextStatus ? "Registro ativado" : "Registro desativado")
      refresh()
    } else {
      setPatch(id, null)
      toast.error(result.error || `Erro ao ${nextStatus ? "ativar" : "desativar"} registro`)
    }
  }

  return {
    router,
    searchParams,
    deleteDialog,
    setDeleteDialog,
    editDialog,
    setEditDialog,
    pushParams,
    refresh,
    isPending,
    handleDelete,
    handleRestore,
    handleToggleStatus,
    optimisticRows,
    sort,
    onSortChange,
  }
}
