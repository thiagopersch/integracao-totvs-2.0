"use server";

import { revalidatePath } from "next/cache";
import { mapeadorService } from "@/services/mapeador.service";
import { auditService } from "@/services/audit.service";
import { clientService } from "@/services/client.service";
import { requirePermission } from "@/lib/rbac";
import {
  createEtapaSchema,
  createMapeadorProjetoSchema,
  renameMapeadorProjetoSchema,
  reorderEtapasSchema,
  updateEtapaSchema,
  updateInformacoesAdicionaisSchema,
  updatePrototipoConfigSchema,
} from "@/schemas/mapeador.schema";
import type { MapeadorProjetoDTO } from "@/types/mapeador";

function fail(error: unknown) {
  return { success: false as const, error: (error as Error).message };
}

export async function listMapeadorProjetos() {
  const { organizationId } = await requirePermission("mapeador_projetos", "read");
  return mapeadorService.listProjetos(organizationId);
}

export async function listMapeadorTemplates() {
  const { organizationId } = await requirePermission("mapeador_projetos", "read");
  return mapeadorService.listTemplates(organizationId);
}

export async function listClientesParaMapeador() {
  const { organizationId, allowedClientIds } = await requirePermission("mapeador_projetos", "read");
  return clientService.listAll(organizationId, allowedClientIds);
}

export async function createMapeadorProjetosFromTemplates(templateIds: string[], clienteId?: string | null) {
  const { organizationId } = await requirePermission("mapeador_projetos", "create");
  if (!templateIds.length) return fail(new Error("Selecione ao menos uma forma de ingresso"));

  try {
    const created = await mapeadorService.createProjetosFromTemplates(templateIds, organizationId, clienteId ?? null);
    for (const projeto of created) {
      await auditService.log({ action: "CREATE", entity: "MapeadorProjeto", entityId: projeto.id, newData: { nome: projeto.nome, fromTemplate: true } });
    }
    revalidatePath("/projetos/mapeador");
    return { success: true as const, data: created };
  } catch (error) {
    return fail(error);
  }
}

export async function getMapeadorProjeto(id: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "read");
  return mapeadorService.getProjeto(id, organizationId);
}

export async function createMapeadorProjeto(nome: string, clienteId?: string | null) {
  const { organizationId } = await requirePermission("mapeador_projetos", "create");
  const parsed = createMapeadorProjetoSchema.safeParse({ nome, clienteId });
  if (!parsed.success) return fail(new Error("Nome inválido"));

  try {
    const projeto = await mapeadorService.createProjeto(parsed.data.nome, organizationId, parsed.data.clienteId ?? null);
    await auditService.log({ action: "CREATE", entity: "MapeadorProjeto", entityId: projeto.id, newData: { nome: projeto.nome } });
    revalidatePath("/projetos/mapeador");
    return { success: true as const, data: projeto };
  } catch (error) {
    return fail(error);
  }
}

export async function renameMapeadorProjeto(id: string, nome: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = renameMapeadorProjetoSchema.safeParse({ nome });
  if (!parsed.success) return fail(new Error("Nome inválido"));

  try {
    const projeto = await mapeadorService.renameProjeto(id, parsed.data.nome, organizationId);
    revalidatePath("/projetos/mapeador");
    revalidatePath(`/projetos/mapeador/${id}`);
    return { success: true as const, data: projeto };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMapeadorProjeto(id: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "delete");
  try {
    await mapeadorService.softDeleteProjeto(id, organizationId);
    await auditService.log({ action: "DELETE", entity: "MapeadorProjeto", entityId: id });
    revalidatePath("/projetos/mapeador");
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMapeadorInformacoesAdicionais(id: string, data: Record<string, string | undefined>) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = updateInformacoesAdicionaisSchema.safeParse(data);
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    await mapeadorService.updateInformacoesAdicionais(id, parsed.data, organizationId);
    revalidatePath(`/projetos/mapeador/${id}`);
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMapeadorPrototipoConfig(id: string, data: Record<string, unknown>) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = updatePrototipoConfigSchema.safeParse(data);
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    await mapeadorService.updatePrototipoConfig(id, parsed.data, organizationId);
    revalidatePath(`/projetos/mapeador/${id}`);
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function createMapeadorEtapa(projetoId: string, nome: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = createEtapaSchema.safeParse({ nome });
  if (!parsed.success) return fail(new Error("Nome da etapa é obrigatório"));

  try {
    const etapa = await mapeadorService.createEtapa(projetoId, parsed.data.nome, organizationId);
    revalidatePath(`/projetos/mapeador/${projetoId}`);
    return { success: true as const, data: etapa };
  } catch (error) {
    return fail(error);
  }
}

export async function duplicateMapeadorEtapa(etapaId: string, projetoId: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  try {
    const etapa = await mapeadorService.duplicateEtapa(etapaId, organizationId);
    revalidatePath(`/projetos/mapeador/${projetoId}`);
    return { success: true as const, data: etapa };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMapeadorEtapa(
  etapaId: string,
  projetoId: string,
  data: { nome?: string; condicao?: string | null; regras?: string | null; camposPorEtapa?: unknown[]; feedbacks?: unknown[] }
) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = updateEtapaSchema.safeParse(data);
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    await mapeadorService.updateEtapa(etapaId, parsed.data as never, organizationId);
    revalidatePath(`/projetos/mapeador/${projetoId}`);
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function deleteMapeadorEtapa(etapaId: string, projetoId: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  try {
    await mapeadorService.deleteEtapa(etapaId, organizationId);
    revalidatePath(`/projetos/mapeador/${projetoId}`);
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function reorderMapeadorEtapas(projetoId: string, ids: string[]) {
  const { organizationId } = await requirePermission("mapeador_projetos", "update");
  const parsed = reorderEtapasSchema.safeParse({ ids });
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    await mapeadorService.reorderEtapas(projetoId, parsed.data.ids, organizationId);
    revalidatePath(`/projetos/mapeador/${projetoId}`);
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}

export async function importMapeadorProjeto(json: string) {
  const { organizationId } = await requirePermission("mapeador_projetos", "create");
  try {
    const data = JSON.parse(json) as MapeadorProjetoDTO;
    if (!data.nome || !Array.isArray(data.etapas)) throw new Error("Arquivo JSON inválido");

    const projeto = await mapeadorService.importProjeto(data, organizationId);
    await auditService.log({ action: "CREATE", entity: "MapeadorProjeto", entityId: projeto.id, newData: { nome: projeto.nome, imported: true } });
    revalidatePath("/projetos/mapeador");
    return { success: true as const, data: projeto };
  } catch (error) {
    return fail(error);
  }
}
