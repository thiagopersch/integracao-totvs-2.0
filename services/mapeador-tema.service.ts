import { prisma } from "@/lib/prisma";
import { MAPEADOR_TEMA_PADRAO_CONFIG } from "@/lib/mapeador/tema-defaults";
import { clienteIdentidadeMudou } from "@/lib/mapeador/cliente-identidade";
import { clientService } from "@/services/client.service";
import type { Prisma } from "@/generated/prisma/client";
import type { MapeadorTemaConfig, MapeadorTemaDTO } from "@/types/mapeador";

const TEMA_PADRAO_NOME = "Padrão";

function toDTO(tema: { id: string; nome: string; config: unknown }): MapeadorTemaDTO {
  return { id: tema.id, nome: tema.nome, config: (tema.config as MapeadorTemaConfig | null) ?? {} };
}

export const mapeadorTemaService = {
  async list(organizationId: string): Promise<MapeadorTemaDTO[]> {
    // Guarantees the org's editable "Padrão" tema always shows up (self-heals if ever deleted) —
    // see `getOrCreatePadrao`.
    await this.getOrCreatePadrao(organizationId);
    const temas = await prisma.mapeadorTema.findMany({ where: { organizationId }, orderBy: { nome: "asc" } });
    return temas.map(toDTO);
  },

  async create(nome: string, config: MapeadorTemaConfig, organizationId: string): Promise<MapeadorTemaDTO> {
    const tema = await prisma.mapeadorTema.create({
      data: { organizationId, nome, config: config as Prisma.InputJsonValue },
    });
    return toDTO(tema);
  },

  async update(id: string, data: { nome?: string; config?: MapeadorTemaConfig }, organizationId: string): Promise<MapeadorTemaDTO> {
    const tema = await prisma.mapeadorTema.findFirst({ where: { id, organizationId } });
    if (!tema) throw new Error("Tema não encontrado");

    const updated = await prisma.mapeadorTema.update({
      where: { id },
      data: {
        ...(data.nome ? { nome: data.nome } : {}),
        ...(data.config ? { config: data.config as Prisma.InputJsonValue } : {}),
      },
    });
    return toDTO(updated);
  },

  async delete(id: string, organizationId: string) {
    const tema = await prisma.mapeadorTema.findFirst({ where: { id, organizationId } });
    if (!tema) throw new Error("Tema não encontrado");

    return prisma.mapeadorTema.delete({ where: { id } });
  },

  /**
   * The org's baseline appearance for any protótipo that has no tema explicitly applied — a
   * normal, editable `MapeadorTema` (found by its fixed name) instead of colors hardcoded in
   * component code, so improving "the default" is just editing this tema like any other.
   */
  async getOrCreatePadrao(organizationId: string): Promise<MapeadorTemaDTO> {
    const existing = await prisma.mapeadorTema.findFirst({ where: { organizationId, nome: TEMA_PADRAO_NOME } });
    if (existing) return toDTO(existing);

    const created = await prisma.mapeadorTema.create({
      data: { organizationId, nome: TEMA_PADRAO_NOME, config: MAPEADOR_TEMA_PADRAO_CONFIG as Prisma.InputJsonValue },
    });
    return toDTO(created);
  },

  /**
   * Compares a tema/protótipo config snapshotted from a Client against that client's current
   * registration. Returns null when the config isn't client-sourced (or the client is no longer
   * in the caller's scope) — that's the "nothing to warn about" case for the drift banner.
   */
  async checkClienteIdentidade(
    config: { origem?: string; clienteId?: string | null; corMarca?: string; logoUrl?: string | null; bgImageUrl?: string | null },
    organizationId: string,
    allowedClientIds: string[],
  ): Promise<{ clienteNome: string; mudou: boolean } | null> {
    if (config.origem !== "cliente" || !config.clienteId) return null;
    const cliente = await clientService.getById(config.clienteId, organizationId, allowedClientIds);
    if (!cliente) return null;
    return { clienteNome: cliente.name, mudou: clienteIdentidadeMudou(config, cliente) };
  },
};
