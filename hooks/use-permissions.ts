"use client"

import { useSession } from "next-auth/react"
import { hasPermission } from "@/lib/permissions"

export function usePermissions(): string[] {
  const { data: session } = useSession()
  return session?.user.permissions ?? []
}

/** Convenience for gating a single CRUD action, e.g. `useHasPermission("clients", "create")`. */
export function useHasPermission(resource: string, action: string = "read"): boolean {
  const permissions = usePermissions()
  return hasPermission(permissions, resource, action)
}
