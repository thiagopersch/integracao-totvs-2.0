"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useTransition } from "react"

export type ParamUpdates = Record<string, string | number | null | undefined>

/**
 * Server-rendered pages refetch by navigating (URL search params) or `router.refresh()`. Running
 * those inside a transition keeps the current UI on screen and exposes `isPending`, so the
 * component whose data is being replaced can show its own loading state (see PendingRegion).
 */
export function useUrlParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function buildHref(updates: ParamUpdates) {
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(updates).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") params.delete(key)
      else params.set(key, String(value))
    })
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  function pushParams(updates: ParamUpdates) {
    startTransition(() => router.push(buildHref(updates)))
  }

  function replaceParams(updates: ParamUpdates) {
    startTransition(() => router.replace(buildHref(updates)))
  }

  function navigate(href: string) {
    startTransition(() => router.push(href))
  }

  function refresh() {
    startTransition(() => router.refresh())
  }

  return { router, searchParams, isPending, startTransition, pushParams, replaceParams, navigate, refresh }
}
