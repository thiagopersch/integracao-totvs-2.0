"use client"

import { useSession } from "next-auth/react"
import type { AuthUser } from "@/types/auth"

export function useCurrentUser() {
  const { data: session, status } = useSession()

  const user: AuthUser | null = session?.user
    ? {
        id: session.user.id,
        name: session.user.name ?? "",
        email: session.user.email ?? "",
        image: session.user.image ?? null,
        role: session.user.role,
        organizationId: session.user.organizationId,
        status: true,
        changePassword: session.user.changePassword,
      }
    : null

  return { user, loading: status === "loading" }
}
