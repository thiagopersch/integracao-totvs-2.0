import type { AcaoBotaoSpec, DocOptions, EncaminhamentoSpec, ItemSpec } from "./types";

/** Shared decisions for the "Conteúdo da documentação" answers, so the HTML, Markdown and DOCX
 *  renderers stay identical in what they show for each option. */

/** A campo follows "Gerar detalhes dos campos"; every other categoria (CEP included — it's a
 *  "Componente de CEP") follows "Gerar detalhes dos componentes". */
export function isItemDetailed(item: ItemSpec, opts: DocOptions): boolean {
  return item.categoria === "campo" ? opts.detalhesCampos : opts.detalhesComponentes;
}

/** The name shown for an ação when "Gerar detalhes das ações do botão" is "Não": the builder's own
 *  description of the action, or "[ordem] Tipo da ação" when it has none. */
export function acaoNome(acao: AcaoBotaoSpec): string {
  return acao.titulo?.trim() || `[${acao.ordem}] ${acao.tipoAcao}`;
}

/** "Tipo → destino" (just "Tipo" when the destino is the tipo itself, e.g. "Fechar pop-up"). */
export function encaminhamentoNome(enc: EncaminhamentoSpec): string {
  return enc.destino && enc.destino !== enc.tipo ? `${enc.tipo} → ${enc.destino}` : enc.tipo;
}

/** Splits an item list into runs: consecutive compact items are grouped so they render as ONE
 *  bullet list instead of one list (and one separator) per item. */
export function groupByDetail(items: ItemSpec[], opts: DocOptions): { detailed: boolean; items: ItemSpec[] }[] {
  const runs: { detailed: boolean; items: ItemSpec[] }[] = [];
  for (const item of items) {
    const detailed = isItemDetailed(item, opts);
    const last = runs[runs.length - 1];
    if (last && !last.detailed && !detailed) last.items.push(item);
    else runs.push({ detailed, items: [item] });
  }
  return runs;
}
