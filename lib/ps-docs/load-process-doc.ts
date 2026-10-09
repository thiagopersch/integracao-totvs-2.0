import { listSelectiveProcessStages, fetchStageDocumentation, type ActionCatalogEntries } from "@/actions/integrations/ps-docs";
import type { PsCredentials } from "@/lib/ps-docs/credential";
import type { DocumentacaoPS } from "@/lib/ps-docs/types";

export type LoadProcessDocResult =
  | { success: true; doc: DocumentacaoPS; fieldCatalogEntries: [number, string][]; actionCatalogEntries?: ActionCatalogEntries; warnings: string[] }
  | { success: false; error: string };

/** Reads a whole processo seletivo, one etapa at a time — the same two-step sequence the
 *  "Documentação PS" page runs (`listSelectiveProcessStages` then `fetchStageDocumentation` per
 *  stage), reporting progress after each etapa. Client-side helper (calls Server Actions). */
export async function loadProcessDoc(input: {
  credentials: PsCredentials;
  idPs: string;
  crmDomain?: string;
  fallbackTitle?: string;
  onProgress?: (done: number, total: number) => void;
}): Promise<LoadProcessDocResult> {
  const listRes = await listSelectiveProcessStages({ credentials: input.credentials, idPs: input.idPs, crmDomain: input.crmDomain?.trim() || undefined });
  if (!listRes.success || !listRes.stages || !listRes.fieldCatalogEntries) {
    return { success: false, error: listRes.error || "Erro ao consultar o processo seletivo" };
  }

  const doc: DocumentacaoPS = { tituloPortal: listRes.tituloPortal ?? input.fallbackTitle ?? `Processo Seletivo ${input.idPs}`, idPs: listRes.idPs ?? input.idPs, etapas: [] };
  const warnings: string[] = [...(listRes.catalogWarnings ?? [])];
  input.onProgress?.(0, listRes.stages.length);

  let done = 0;
  for (const stage of listRes.stages) {
    const stageRes = await fetchStageDocumentation({
      credentials: input.credentials,
      idPs: input.idPs,
      stage: stage.ref,
      fieldCatalogEntries: listRes.fieldCatalogEntries,
      actionCatalogEntries: listRes.actionCatalogEntries,
    });
    if (stageRes.success && stageRes.etapa) {
      doc.etapas.push(stageRes.etapa);
      if (stageRes.warnings) warnings.push(...stageRes.warnings);
    } else {
      warnings.push(`Etapa "${stage.label}": ${stageRes.error ?? "falha ao consultar"}`);
    }
    input.onProgress?.(++done, listRes.stages.length);
  }

  return { success: true, doc, fieldCatalogEntries: listRes.fieldCatalogEntries, actionCatalogEntries: listRes.actionCatalogEntries, warnings };
}
