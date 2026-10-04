"use client"

import { useState } from "react"
import { toast } from "sonner"
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
}

export function useCrudTable<TEntity>(options: UseCrudTableOptions) {
  // Every navigation/refresh runs in a transition so the table can show its own pending state
  // (DataTable `refreshing`) instead of the page freezing or being swapped for a skeleton.
  const { router, searchParams, isPending, pushParams, refresh } = useUrlParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; entity?: TEntity }>({ open: false })

  const sortParam = searchParams.get("sort")
  const sort: SortState | undefined = sortParam
    ? { field: sortParam.split(":")[0], direction: sortParam.split(":")[1] as "asc" | "desc" }
    : options.defaultSort

  function onSortChange(next: SortState) {
    pushParams({ sort: `${next.field}:${next.direction}`, page: 1 })
  }

  async function handleDelete(id: string) {
    const result = await options.deleteAction(id)
    if (result.success) {
      toast.success(options.deleteSuccessMessage)
      refresh()
    } else {
      toast.error(result.error || options.deleteErrorMessage || "Erro ao excluir")
    }
    setDeleteDialog({ open: false })
  }

  async function handleRestore(id: string) {
    if (!options.restoreAction) return
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
    const result = await options.setStatusAction(id, nextStatus)
    if (result.success) {
      toast.success(nextStatus ? "Registro ativado" : "Registro desativado")
      refresh()
    } else {
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
    sort,
    onSortChange,
  }
}
