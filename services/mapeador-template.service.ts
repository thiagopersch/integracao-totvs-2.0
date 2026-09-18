import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { MapeadorTemplateEtapa } from "@/lib/mapeador/templates";
import { flattenCampos } from "@/types/mapeador";
import type { MapeadorInformacoesAdicionais, MapeadorProjetoDTO, MapeadorTemplateSummary } from "@/types/mapeador";

export interface MapeadorTemplateModelo {
  id: string;
  nome: string;
  informacoesAdicionais: MapeadorInformacoesAdicionais;
  etapas: MapeadorTemplateEtapa[];
}

function toModelo(row: { id: string; nome: string; informacoesAdicionais: unknown; etapas: unknown }): MapeadorTemplateModelo {
  return {
    id: row.id,
    nome: row.nome,
    informacoesAdicionais: (row.informacoesAdicionais as MapeadorInformacoesAdicionais | null) ?? {},
    etapas: (row.etapas as MapeadorTemplateEtapa[] | null) ?? [],
  };
}

export const mapeadorTemplateService = {
  async listSummaries(organizationId: string): Promise<MapeadorTemplateSummary[]> {
    const rows = await prisma.mapeadorTemplateProjeto.findMany({ where: { organizationId }, orderBy: { nome: "asc" } });
    return rows.map((row) => {
      const etapas = (row.etapas as MapeadorTemplateEtapa[] | null) ?? [];
      return {
        id: row.id,
        nome: row.nome,
        etapasCount: etapas.length,
        itensCount: etapas.reduce((sum, e) => sum + (e.camposPorEtapa ?? []).reduce((s, p) => s + flattenCampos(p.campos).length, 0), 0),
        origem: "modelo" as const,
      };
    });
  },

  async get(id: string, organizationId: string): Promise<MapeadorTemplateModelo | null> {
    const row = await prisma.mapeadorTemplateProjeto.findFirst({ where: { id, organizationId } });
    return row ? toModelo(row) : null;
  },

  /** Snapshots a project's current etapas/campos into a new reusable template — a point-in-time
   *  copy, same as the static "Padrão Rubeus" templates, so later edits to the source project
   *  don't retroactively change the saved modelo. */
  async createFromProjeto(projeto: MapeadorProjetoDTO, nome: string, organizationId: string): Promise<MapeadorTemplateModelo> {
    const etapas: MapeadorTemplateEtapa[] = projeto.etapas.map((etapa) => ({
      ordem: etapa.ordem,
      nome: etapa.nome,
      condicao: etapa.condicao,
      regras: etapa.regras,
      camposPorEtapa: etapa.camposPorEtapa,
      feedbacks: etapa.feedbacks,
    }));

    const created = await prisma.mapeadorTemplateProjeto.create({
      data: {
        organizationId,
        nome,
        informacoesAdicionais: projeto.informacoesAdicionais as Prisma.InputJsonValue,
        etapas: etapas as unknown as Prisma.InputJsonValue,
      },
    });
    return toModelo(created);
  },

  async delete(id: string, organizationId: string) {
    const row = await prisma.mapeadorTemplateProjeto.findFirst({ where: { id, organizationId } });
    if (!row) throw new Error("Modelo não encontrado");
    return prisma.mapeadorTemplateProjeto.delete({ where: { id } });
  },
};
