"use server";

import * as XLSX from "xlsx";
import { requirePermission } from "@/lib/rbac";
import { mapeadorService } from "@/services/mapeador.service";
import { MAPEADOR_CAMPO_TIPO_LABELS } from "@/types/mapeador";

export async function exportMapeadorProjetoJson(id: string) {
  try {
    const { organizationId } = await requirePermission("mapeador_projetos", "read");
    const projeto = await mapeadorService.getProjeto(id, organizationId);
    if (!projeto) throw new Error("Projeto não encontrado");

    return {
      success: true as const,
      json: JSON.stringify(projeto, null, 2),
      fileName: `${projeto.nome.toLowerCase().replace(/\s+/g, "-")}.json`,
    };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

export async function exportMapeadorProjetoXlsx(id: string) {
  try {
    const { organizationId } = await requirePermission("mapeador_projetos", "read");
    const projeto = await mapeadorService.getProjeto(id, organizationId);
    if (!projeto) throw new Error("Projeto não encontrado");

    const etapasRows = projeto.etapas.map((etapa) => ({
      Ordem: etapa.ordem,
      Etapa: etapa.nome,
      "Condição para liberar a etapa": etapa.condicao ?? "",
      "Regras/Validações": etapa.regras ?? "",
    }));

    const camposRows = projeto.etapas.flatMap((etapa) =>
      etapa.camposPorEtapa.flatMap((passo) =>
        passo.campos.map((campo) => ({
          Etapa: etapa.nome,
          Passo: passo.titulo,
          "Tipo do passo": passo.tipo,
          Campo: campo.label,
          Tipo: MAPEADOR_CAMPO_TIPO_LABELS[campo.tipo] ?? campo.tipo,
          Obrigatório: campo.obrigatorio ? "Sim" : "Não",
          "Condição de exibição": campo.condicaoExibicao ?? "",
        }))
      )
    );

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(etapasRows), "Etapas da Ficha");
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(camposRows), "Campos por Etapa");
    const base64 = XLSX.write(workbook, { type: "base64", bookType: "xlsx" }) as string;

    return {
      success: true as const,
      base64,
      fileName: `${projeto.nome.toLowerCase().replace(/\s+/g, "-")}.xlsx`,
    };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
