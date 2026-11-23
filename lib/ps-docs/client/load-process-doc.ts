import { fetchStageDocumentation, listSelectiveProcessStages } from "@/actions/integrations/ps-docs"
import type { PsCredentials } from "@/lib/ps-docs/credential"
import type { DocumentacaoPS } from "@/lib/ps-docs/types"

export type LoadProcessDocResult =
  | { success: true; doc: DocumentacaoPS; warnings: string[] }
  | { success: false; error: string }

/** Reads a whole selective process the way the admin SPA does — the stage list first, then one
 *  `fetchStageDocumentation` call per active stage — reporting the partial model after each step
 *  so the caller can render etapas as they arrive. Shared by "Gerar documentação" and
 *  "Comparar processos". */
export async function loadProcessDoc(input: {
  credentials: PsCredentials
  idPs: string
  crmDomain?: string
  /** Fallback title when the API doesn't return one. */
  fallbackTitle?: string
  /** Fallback portal id when the API doesn't return one. */
  fallbackIdPortal?: string
  onStart?: (doc: DocumentacaoPS, totalStages: number) => void
  onStage?: (doc: DocumentacaoPS, done: number, total: number) => void
}): Promise<LoadProcessDocResult> {
  const { credentials, idPs } = input
  const listRes = await listSelectiveProcessStages({ credentials, idPs, crmDomain: input.crmDomain?.trim() || undefined })
  if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries)
    return { success: false, error: listRes.error || "Erro ao consultar o processo seletivo" }

  let doc: DocumentacaoPS = {
    tituloPortal: listRes.tituloPortal ?? input.fallbackTitle ?? `Processo Seletivo ${idPs}`,
    idPs: listRes.idPs ?? idPs,
    identifier: listRes.identifier,
    idPortal: listRes.idPortal ?? input.fallbackIdPortal,
    etapas: [],
  }
  const total = listRes.stages.length
  input.onStart?.(doc, total)

  const warnings: string[] = [...(listRes.catalogWarnings ?? [])]
  let done = 0
  for (const stage of listRes.stages) {
    const stageRes = await fetchStageDocumentation({
      credentials,
      idPs,
      stage: stage.ref,
      fieldCatalogEntries: listRes.fieldCatalogEntries,
      actionCatalogEntries: listRes.actionCatalogEntries,
    })
    if (stageRes.success && stageRes.etapa) {
      doc = { ...doc, etapas: [...doc.etapas, stageRes.etapa] }
      if (stageRes.warnings) warnings.push(...stageRes.warnings)
    } else {
      warnings.push(`Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar"}`)
    }
    done += 1
    input.onStage?.(doc, done, total)
  }

  return { success: true, doc, warnings }
}
