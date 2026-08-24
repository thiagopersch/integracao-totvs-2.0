"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

type ActionResult = { success: boolean; error?: string }

interface UseCrudTableOptions {
  deleteAction: (id: string) => Promise<ActionResult>
  restoreAction?: (id: string) => Promise<ActionResult>
  deleteSuccessMessage: string
  deleteErrorMessage?: string
  restoreSuccessMessage?: string
  restoreErrorMessage?: string
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
  }
}
