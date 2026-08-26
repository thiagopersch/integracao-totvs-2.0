"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id?: string }>({ open: false })
  const [editDialog, setEditDialog] = useState<{ open: boolean; entity?: TEntity }>({ open: false })

  function pushParams(updates: Record<string, string | number | undefined>) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === "") params.delete(key)
      else params.set(key, String(value))
    })
    router.push(`?${params.toString()}`)
  }

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
      router.refresh()
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
      router.refresh()
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
      router.refresh()
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
    handleDelete,
    handleRestore,
    handleToggleStatus,
    sort,
    onSortChange,
  }
}
