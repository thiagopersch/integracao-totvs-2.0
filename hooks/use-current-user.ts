"use client"

import { useMemo } from "react"
import { useSession } from "next-auth/react"
import type { AuthUser } from "@/types/auth"

/** The signed-in user. Memoized on the session object, so consumers don't re-render on every parent render. */
export function useCurrentUser() {
  const { data: session, status } = useSession()
  const sessionUser = session?.user

  const user = useMemo<AuthUser | null>(
    () =>
      sessionUser
        ? {
            id: sessionUser.id,
            name: sessionUser.name ?? "",
            email: sessionUser.email ?? "",
            image: sessionUser.image ?? null,
            role: sessionUser.role,
            organizationId: sessionUser.organizationId,
            status: true,
            changePassword: sessionUser.changePassword,
          }
        : null,
    [sessionUser]
  )

  return { user, loading: status === "loading" }
}
