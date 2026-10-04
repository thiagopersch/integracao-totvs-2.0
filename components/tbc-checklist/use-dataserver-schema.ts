"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { fetchDataserverSchema } from "@/actions/integrations/tbc-checklist"
import { toChecklistContext, type ChecklistContextForm } from "@/lib/tbc-checklist-dataservers"
import type { SchemaTable } from "@/utils/soap-schema"
import type { Dataserver } from "@/generated/prisma/client"

/**
 * GetSchema for the picked Data Server, run automatically (debounced) as soon as coligada, filial
 * and tipo de curso are all filled — TOTVS needs that Contexto to resolve the schema, so nothing is
 * requested before. Each Data Server + Contexto combination is fetched once; `refetch` forces it
 * again. `onLoaded` receives the tables of every successful fetch (stale responses are dropped).
 */
export function useDataserverSchema(
  tbcId: string,
  dataserver: Dataserver | undefined,
  contextForm: ChecklistContextForm,
  onLoaded: (tables: SchemaTable[]) => void
) {
  const { coligate, branch, levelEducation } = contextForm
  const context = useMemo(
    () => toChecklistContext({ coligate, branch, levelEducation }),
    [coligate, branch, levelEducation]
  )
  const requestKey =
    dataserver && context ? `${dataserver.code}|${context.coligate}|${context.branch}|${context.levelEducation}` : ""
  const [loadingKey, setLoadingKey] = useState("")
  const latestKeyRef = useRef("")
  const onLoadedRef = useRef(onLoaded)

  useEffect(() => {
    onLoadedRef.current = onLoaded
  })

  const refetch = useCallback(async () => {
    if (!dataserver || !context) return
    const key = `${dataserver.code}|${context.coligate}|${context.branch}|${context.levelEducation}`
    latestKeyRef.current = key
    setLoadingKey(key)
    const result = await fetchDataserverSchema({ tbcId, dataserverCode: dataserver.code, context })
    setLoadingKey((current) => (current === key ? "" : current))
    if (latestKeyRef.current !== key) return
    if (!result.success) {
      toast.error(result.error || `Falha ao buscar schema do Data Server "${dataserver.name}"`)
      return
    }
    onLoadedRef.current(result.tables)
  }, [tbcId, dataserver, context])

  // Debounced so typing "12" in coligada doesn't fire a GetSchema for "1" first.
  useEffect(() => {
    if (!requestKey) {
      // Data Server cleared or Contexto incomplete: forget the last fetch, so picking the same
      // combination again fetches (and re-fills the caller's fields) instead of being skipped.
      latestKeyRef.current = ""
      return
    }
    if (requestKey === latestKeyRef.current) return
    const timer = setTimeout(() => void refetch(), 500)
    return () => clearTimeout(timer)
  }, [requestKey, refetch])

  const loading = loadingKey !== "" && loadingKey === requestKey
  return { context, contextComplete: context !== null, loading, refetch }
}
