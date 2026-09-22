"use server";

import { revalidatePath } from "next/cache";
import { mapeadorTemaService } from "@/services/mapeador-tema.service";
import { clientService } from "@/services/client.service";
import { requirePermission } from "@/lib/rbac";
import { createMapeadorTemaSchema, updateMapeadorTemaSchema } from "@/schemas/mapeador-tema.schema";
import type { MapeadorTemaConfig } from "@/types/mapeador";

function fail(error: unknown) {
  return { success: false as const, error: (error as Error).message };
}

export async function listMapeadorTemas() {
  const { organizationId } = await requirePermission("mapeador_temas", "read");
  return mapeadorTemaService.list(organizationId);
}

export async function createMapeadorTema(nome: string, config: MapeadorTemaConfig) {
  const { organizationId } = await requirePermission("mapeador_temas", "create");
  const parsed = createMapeadorTemaSchema.safeParse({ nome, config });
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    const tema = await mapeadorTemaService.create(parsed.data.nome, parsed.data.config, organizationId);
    revalidatePath("/projetos/mapeador", "layout");
    return { success: true as const, data: tema };
  } catch (error) {
    return fail(error);
  }
}

export async function updateMapeadorTema(id: string, data: { nome?: string; config?: MapeadorTemaConfig }) {
  const { organizationId } = await requirePermission("mapeador_temas", "update");
  const parsed = updateMapeadorTemaSchema.safeParse(data);
  if (!parsed.success) return fail(new Error("Dados inválidos"));

  try {
    const tema = await mapeadorTemaService.update(id, parsed.data, organizationId);
    revalidatePath("/projetos/mapeador", "layout");
    return { success: true as const, data: tema };
  } catch (error) {
    return fail(error);
  }
}

export async function listClientesParaTema() {
  const { organizationId, allowedClientIds } = await requirePermission("mapeador_temas", "read");
  return clientService.listAll(organizationId, allowedClientIds);
}

export async function checkClienteIdentidadeTema(config: {
  origem?: string;
  clienteId?: string | null;
  corMarca?: string;
  logoUrl?: string | null;
  bgImageUrl?: string | null;
}) {
  const { organizationId, allowedClientIds } = await requirePermission("mapeador_temas", "read");
  return mapeadorTemaService.checkClienteIdentidade(config, organizationId, allowedClientIds);
}

export async function deleteMapeadorTema(id: string) {
  const { organizationId } = await requirePermission("mapeador_temas", "delete");
  try {
    await mapeadorTemaService.delete(id, organizationId);
    revalidatePath("/projetos/mapeador", "layout");
    return { success: true as const };
  } catch (error) {
    return fail(error);
  }
}
