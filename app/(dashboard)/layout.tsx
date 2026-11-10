import { Suspense } from "react"
import { cookies } from "next/headers"
import { auth } from "@/auth"
import { getAiAssistantBubbleEnabled } from "@/actions/ai-assistant"
import { DashboardShell, SIDEBAR_COOKIE } from "@/components/shared/dashboard-shell"
import { ShellSkeleton } from "@/components/shared/skeletons/shell-skeleton"
import { visibleNavGroups } from "@/lib/nav-items"
import { SessionProvider } from "@/providers/session-provider"

/**
 * Dashboard shell rendered on the server: the session, the permission-filtered menu, the sidebar
 * state (cookie) and the AI-assistant flag are resolved here, so the first paint is complete and
 * the client never waits on /api/auth/session to draw the navigation.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  )
}

async function Shell({ children }: { children: React.ReactNode }) {
  const [session, cookieStore, aiEnabled] = await Promise.all([auth(), cookies(), getAiAssistantBubbleEnabled()])
  const groups = visibleNavGroups(session?.user?.permissions ?? [])
  const user = { name: session?.user?.name ?? "", email: session?.user?.email ?? "", image: session?.user?.image ?? null }
  return (
    <SessionProvider session={session}>
      <DashboardShell groups={groups} initialCollapsed={cookieStore.get(SIDEBAR_COOKIE)?.value === "1"} aiEnabled={aiEnabled} user={user}>
        <Suspense fallback={null}>{children}</Suspense>
      </DashboardShell>
    </SessionProvider>
  )
}
