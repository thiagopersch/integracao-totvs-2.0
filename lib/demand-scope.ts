import { cache } from "react"
import { prisma } from "@/lib/prisma"
import type { RequestContext } from "@/lib/tenant"
import { hasPermission } from "@/lib/permissions"

const NO_LINKED_ANALYST = "__no-linked-analyst__"

export async function canViewAllAnalysts(ctx: RequestContext): Promise<boolean> {
  return hasPermission(ctx.permissions, "analysts", "read")
}

/**
 * Returns undefined when the user can see every demand (privileged), or the
 * analystId to restrict to. Returns a sentinel that matches nothing when the
 * user has no linked Analyst record, so they see zero demands rather than an error.
 */
export async function getDemandAnalystScope(ctx: RequestContext): Promise<string | undefined> {
  if (await canViewAllAnalysts(ctx)) return undefined
  return (await findLinkedAnalystId(ctx.userId)) ?? NO_LINKED_ANALYST
}

/** Per-request memo: /demands resolves the scope for the list, the filter options and the periods. */
const findLinkedAnalystId = cache(async (userId: string) => {
  const analyst = await prisma.analyst.findUnique({ where: { userId }, select: { id: true } })
  return analyst?.id ?? null
})
