import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CamposPorEtapa,
  MapeadorEtapaDTO,
  MapeadorInformacoesAdicionais,
  MapeadorProjetoDTO,
  MapeadorProjetoSummary,
  MapeadorPrototipoConfig,
} from "@/types/mapeador";

function toEtapaDTO(etapa: {
  id: string;
  ordem: number;
  nome: string;
  condicao: string | null;
  regras: string | null;
  camposPorEtapa: unknown;
}): MapeadorEtapaDTO {
  return {
    id: etapa.id,
    ordem: etapa.ordem,
    nome: etapa.nome,
    condicao: etapa.condicao,
    regras: etapa.regras,
    camposPorEtapa: (etapa.camposPorEtapa as CamposPorEtapa | null) ?? [],
  };
}

export const mapeadorService = {
  async listProjetos(organizationId: string): Promise<MapeadorProjetoSummary[]> {
    const projetos = await prisma.mapeadorProjeto.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: { updatedAt: "desc" },
      include: { _count: { select: { etapas: true } } },
    });
    return projetos.map((p) => ({
      id: p.id,
      nome: p.nome,
      etapasCount: p._count.etapas,
      updatedAt: p.updatedAt.toISOString(),
    }));
  },

  async getProjeto(id: string, organizationId: string): Promise<MapeadorProjetoDTO | null> {
    const projeto = await prisma.mapeadorProjeto.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { etapas: { orderBy: { ordem: "asc" } } },
    });
    if (!projeto) return null;

    return {
      id: projeto.id,
      nome: projeto.nome,
      informacoesAdicionais: (projeto.informacoesAdicionais as MapeadorInformacoesAdicionais | null) ?? {},
      prototipoConfig: (projeto.prototipoConfig as MapeadorPrototipoConfig | null) ?? {},
      etapas: projeto.etapas.map(toEtapaDTO),
    };
  },

  async createProjeto(nome: string, organizationId: string) {
    return prisma.mapeadorProjeto.create({ data: { nome, organizationId } });
  },

  async renameProjeto(id: string, nome: string, organizationId: string) {
    return prisma.mapeadorProjeto.update({ where: { id, organizationId }, data: { nome } });
  },

  async softDeleteProjeto(id: string, organizationId: string) {
    return prisma.mapeadorProjeto.update({ where: { id, organizationId }, data: { deletedAt: new Date() } });
  },

  async updateInformacoesAdicionais(id: string, data: MapeadorInformacoesAdicionais, organizationId: string) {
    return prisma.mapeadorProjeto.update({
      where: { id, organizationId },
      data: { informacoesAdicionais: data as Prisma.InputJsonValue },
    });
  },

  async updatePrototipoConfig(id: string, data: MapeadorPrototipoConfig, organizationId: string) {
    return prisma.mapeadorProjeto.update({
      where: { id, organizationId },
      data: { prototipoConfig: data as Prisma.InputJsonValue },
    });
  },

  async createEtapa(projetoId: string, nome: string, organizationId: string) {
    const projeto = await prisma.mapeadorProjeto.findFirst({ where: { id: projetoId, organizationId } });
    if (!projeto) throw new Error("Projeto não encontrado");

    const last = await prisma.mapeadorEtapa.findFirst({
      where: { projetoId },
      orderBy: { ordem: "desc" },
    });
    return prisma.mapeadorEtapa.create({
      data: { projetoId, nome, ordem: (last?.ordem ?? 0) + 1, camposPorEtapa: [] },
    });
  },

  async duplicateEtapa(etapaId: string, organizationId: string) {
    const etapa = await prisma.mapeadorEtapa.findFirst({
      where: { id: etapaId, projeto: { organizationId } },
    });
    if (!etapa) throw new Error("Etapa não encontrada");

    const last = await prisma.mapeadorEtapa.findFirst({
      where: { projetoId: etapa.projetoId },
      orderBy: { ordem: "desc" },
    });
    return prisma.mapeadorEtapa.create({
      data: {
        projetoId: etapa.projetoId,
        nome: `${etapa.nome} (cópia)`,
        condicao: etapa.condicao,
        regras: etapa.regras,
        camposPorEtapa: etapa.camposPorEtapa ?? [],
        ordem: (last?.ordem ?? 0) + 1,
      },
    });
  },

  async updateEtapa(
    etapaId: string,
    data: { nome?: string; condicao?: string | null; regras?: string | null; camposPorEtapa?: CamposPorEtapa },
    organizationId: string
  ) {
    const etapa = await prisma.mapeadorEtapa.findFirst({
      where: { id: etapaId, projeto: { organizationId } },
    });
    if (!etapa) throw new Error("Etapa não encontrada");

    return prisma.mapeadorEtapa.update({
      where: { id: etapaId },
      data: { ...data, camposPorEtapa: data.camposPorEtapa as unknown as Prisma.InputJsonValue },
    });
  },

  async deleteEtapa(etapaId: string, organizationId: string) {
    const etapa = await prisma.mapeadorEtapa.findFirst({
      where: { id: etapaId, projeto: { organizationId } },
    });
    if (!etapa) throw new Error("Etapa não encontrada");

    return prisma.mapeadorEtapa.delete({ where: { id: etapaId } });
  },

  async reorderEtapas(projetoId: string, orderedIds: string[], organizationId: string) {
    const projeto = await prisma.mapeadorProjeto.findFirst({ where: { id: projetoId, organizationId } });
    if (!projeto) throw new Error("Projeto não encontrado");

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.mapeadorEtapa.update({ where: { id }, data: { ordem: index + 1 } }))
    );
  },

  async importProjeto(data: MapeadorProjetoDTO, organizationId: string) {
    return prisma.mapeadorProjeto.create({
      data: {
        organizationId,
        nome: data.nome,
        informacoesAdicionais: (data.informacoesAdicionais ?? {}) as Prisma.InputJsonValue,
        prototipoConfig: (data.prototipoConfig ?? {}) as Prisma.InputJsonValue,
        etapas: {
          create: data.etapas.map((etapa, index) => ({
            ordem: etapa.ordem ?? index + 1,
            nome: etapa.nome,
            condicao: etapa.condicao,
            regras: etapa.regras,
            camposPorEtapa: (etapa.camposPorEtapa ?? []) as unknown as Prisma.InputJsonValue,
          })),
        },
      },
    });
  },
};
