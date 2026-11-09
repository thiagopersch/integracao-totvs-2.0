"use client"

import type { Session } from "next-auth"
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

/**
 * Auth.js session context. The dashboard layout passes the session it already read on the server,
 * so `useSession()` is ready on the first paint and doesn't refetch on every window focus.
 */
export function SessionProvider({ children, session }: { children: React.ReactNode; session?: Session | null }) {
  return (
    <NextAuthSessionProvider session={session ?? undefined} refetchOnWindowFocus={session === undefined}>
      {children}
    </NextAuthSessionProvider>
  )
}
