import templatesData from "@/data/mapeador-rubeus-templates.json";
import type { CamposPorEtapa, MapeadorFeedback, MapeadorInformacoesAdicionais } from "@/types/mapeador";

export interface MapeadorTemplateEtapa {
  ordem: number;
  nome: string;
  condicao: string | null;
  regras: string | null;
  camposPorEtapa: CamposPorEtapa;
  feedbacks: MapeadorFeedback[];
}

export interface MapeadorTemplate {
  id: string;
  nome: string;
  informacoesAdicionais: MapeadorInformacoesAdicionais;
  etapas: MapeadorTemplateEtapa[];
}

/** The 6 "Padrão Rubeus" enrollment-flow templates, extracted from the reference Mapeador de Experiências tool. */
export const MAPEADOR_RUBEUS_TEMPLATES = templatesData as unknown as MapeadorTemplate[];

export function getMapeadorTemplate(id: string): MapeadorTemplate | undefined {
  return MAPEADOR_RUBEUS_TEMPLATES.find((t) => t.id === id);
}
