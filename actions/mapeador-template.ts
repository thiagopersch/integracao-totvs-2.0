"use server";

import { revalidatePath } from "next/cache";
import { mapeadorService } from "@/services/mapeador.service";
import { mapeadorTemplateService } from "@/services/mapeador-template.service";
import { requirePermission } from "@/lib/rbac";

function fail(error: unknown) {
  return { success: false as const, error: (error as Error).message };
}

/** Snapshots a project's current etapas/campos into a new reusable "modelo" — appears alongside
 *  the static "Padrão Rubeus" templates (`listMapeadorTemplates`) when creating a new project. */
export async function createMapeadorTemplateModelo(projetoId: string, nome: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "read");
  if (!nome.trim()) return fail(new Error("Informe um nome para o modelo"));

  try {
    const projeto = await mapeadorService.getProjeto(projetoId, organizationId);
    if (!projeto) return fail(new Error("Projeto não encontrado"));

    const modelo = await mapeadorTemplateService.createFromProjeto(projeto, nome.trim(), organizationId);
    revalidatePath("/projetos/mapeador");
    return { success: true as const, data: modelo };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMapeadorTemplateModelo(id: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "delete");
  try {
    await mapeadorTemplateService.delete(id, organizationId);
    revalidatePath("/projetos/mapeador");
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}
