"use server"

import { prisma } from "@/lib/prisma"
import { hasPermission } from "@/lib/permissions"
import { requirePermission } from "@/lib/rbac"
import { countDictionaryRows, listSentencesForDocs } from "@/queries/sql-docs"

/** Data the page needs on load: sentences to pick from and whether the dictionary was imported. */
export async function getSqlDocsPageData() {
  try {
    const { organizationId, permissions } = await requirePermission("sql_docs", "execute")
    const canReadSentences = hasPermission(permissions, "sentences", "read")
    const [sentences, dictionaryRows] = await Promise.all([canReadSentences ? listSentencesForDocs(organizationId) : Promise.resolve([]), countDictionaryRows()])
    return {
      success: true as const,
      sentences: sentences.map((s) => ({ id: s.id, code: s.code, name: s.name, category: s.category?.name ?? null })),
      dictionaryRows,
    }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}

/** SQL of one sentence, loaded when the user picks it. */
export async function getSentenceSql(id: string) {
  try {
    const { organizationId } = await requirePermission("sentences", "read")
    const sentence = await prisma.sentence.findFirst({
      where: { id: String(id), organizationId, deletedAt: null },
      select: { code: true, name: true, content: true },
    })
    if (!sentence) return { success: false as const, error: "Sentença não encontrada" }
    if (!sentence.content?.trim()) return { success: false as const, error: "A sentença não possui SQL cadastrado" }
    return { success: true as const, ...sentence, content: sentence.content }
  } catch (error) {
    return { success: false as const, error: (error as Error).message }
  }
}
