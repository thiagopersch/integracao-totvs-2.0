import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MapeadorTemaConfig, MapeadorTemaDTO } from "@/types/mapeador";

function toDTO(tema: { id: string; nome: string; config: unknown }): MapeadorTemaDTO {
  return { id: tema.id, nome: tema.nome, config: (tema.config as MapeadorTemaConfig | null) ?? {} };
}

export const mapeadorTemaService = {
  async list(organizationId: string): Promise<MapeadorTemaDTO[]> {
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
};
