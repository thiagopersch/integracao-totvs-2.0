import { acaoNome, encaminhamentoNome } from "./doc-options";
import type {
  AcaoBotaoSpec,
  DocumentacaoPS,
  EncaminhamentoSpec,
  EtapaSpec,
  ItemSpec,
  LogicTrailDoc,
  PassoSpec,
  PortalOverviewSpec,
  TrilhaBreadcrumb,
  TrilhaEntry,
} from "./types";

/** Walks a `DocumentacaoPS`/`PortalOverviewSpec` tree (already fully parsed by
 *  `parse-structure.ts` — no network calls happen here) and flattens every display/execution rule
 *  and every data-origin configuration into a single list of `TrilhaEntry`, each carrying a
 *  breadcrumb of where it lives. Used by the "Trilhas de lógica" documentation, a dedicated view
 *  over the exact same model used by "Gerar documentação". */

function pushBreadcrumb(b: TrilhaBreadcrumb, itemNome: string): TrilhaBreadcrumb {
  return { ...b, itens: [...(b.itens ?? []), itemNome] };
}

function walkAcao(acao: AcaoBotaoSpec, plano: "Primeiro plano" | "Segundo plano", breadcrumb: TrilhaBreadcrumb, out: TrilhaEntry[]): void {
  const acaoBreadcrumb: TrilhaBreadcrumb = { ...breadcrumb, acao: `${plano} · ${acaoNome(acao)}` };
  if (acao.logica && acao.logica.regras.length > 0) {
    out.push({ tipo: "logica-acao", breadcrumb: acaoBreadcrumb, elementoAfetado: acaoNome(acao), logica: acao.logica });
  }
  if (acao.fonteDados && acao.fonteDados.configurada) {
    out.push({
      tipo: "origem-consulta-sql",
      breadcrumb: acaoBreadcrumb,
      elementoAlimentado: acaoNome(acao),
      configuradaEm: "Ação de botão",
      fonteDados: acao.fonteDados,
    });
  }
}

function walkEncaminhamento(enc: EncaminhamentoSpec, breadcrumb: TrilhaBreadcrumb, out: TrilhaEntry[]): void {
  const encBreadcrumb: TrilhaBreadcrumb = { ...breadcrumb, encaminhamento: encaminhamentoNome(enc) };
  if (enc.logica && enc.logica.regras.length > 0) {
    out.push({ tipo: "logica-acao", breadcrumb: encBreadcrumb, elementoAfetado: encaminhamentoNome(enc), logica: enc.logica });
  }
  if (enc.popupDetalhe) {
    const popup = enc.popupDetalhe;
    if (popup.consultaSql.configurada) {
      out.push({
        tipo: "origem-consulta-sql",
        breadcrumb: encBreadcrumb,
        elementoAlimentado: popup.nome,
        configuradaEm: "Pop-up",
        consultaSql: popup.consultaSql,
      });
    }
    for (const item of popup.itens) walkItem(item, encBreadcrumb, out);
  }
  if (enc.paginaDetalhe) {
    for (const item of enc.paginaDetalhe.itens) walkItem(item, encBreadcrumb, out);
  }
}

function walkItem(item: ItemSpec, breadcrumb: TrilhaBreadcrumb, out: TrilhaEntry[]): void {
  if (item.logica && item.logica.regras.length > 0) {
    out.push({ tipo: "logica-elemento", breadcrumb, elementoAfetado: item.nome, logica: item.logica });
  }

  if (item.categoria === "campo") {
    const dd = item.detalhes?.dados;
    if (dd?.opcoesPredefinidas?.fonte === "TOTVS") {
      out.push({
        tipo: "origem-campo-totvs",
        breadcrumb,
        elementoAlimentado: item.nome,
        opcoesPredefinidas: dd.opcoesPredefinidas,
      });
    }
    if (dd?.fonteExterna) {
      out.push({ tipo: "origem-externa", breadcrumb, elementoAlimentado: item.nome, fonteExterna: dd.fonteExterna });
    }
  }

  if (item.categoria === "agrupamento") {
    for (const campo of item.camposAgrupados ?? []) {
      if (campo.logica && campo.logica.regras.length > 0) {
        out.push({ tipo: "logica-elemento", breadcrumb, elementoAfetado: campo.nome, logica: campo.logica });
      }
    }
    const childBreadcrumb = pushBreadcrumb(breadcrumb, item.nome);
    for (const filho of item.filhos ?? []) walkItem(filho, childBreadcrumb, out);
  }

  if (item.categoria === "botao") {
    for (const acao of item.acoesPrimeiroPlano ?? []) walkAcao(acao, "Primeiro plano", { ...breadcrumb, botao: item.nome }, out);
    for (const acao of item.acoesSegundoPlano ?? []) walkAcao(acao, "Segundo plano", { ...breadcrumb, botao: item.nome }, out);
    for (const enc of item.encaminhamentos ?? []) walkEncaminhamento(enc, { ...breadcrumb, botao: item.nome }, out);
  }
}

function walkPasso(passo: PassoSpec, breadcrumb: TrilhaBreadcrumb, out: TrilhaEntry[]): void {
  if (passo.consultaSql.configurada) {
    out.push({
      tipo: "origem-consulta-sql",
      breadcrumb,
      elementoAlimentado: passo.nome,
      configuradaEm: "Passo",
      consultaSql: passo.consultaSql,
    });
  }
  for (const item of passo.itens) walkItem(item, breadcrumb, out);
}

function walkEtapa(etapa: EtapaSpec, out: TrilhaEntry[]): void {
  const breadcrumb: TrilhaBreadcrumb = { etapa: etapa.nome };
  if (etapa.logicaExibicao.regras.length > 0) {
    out.push({ tipo: "logica-elemento", breadcrumb, elementoAfetado: etapa.nome, logica: etapa.logicaExibicao });
  }
  if (etapa.consultaSql.configurada) {
    out.push({
      tipo: "origem-consulta-sql",
      breadcrumb,
      elementoAlimentado: etapa.nome,
      configuradaEm: "Etapa",
      consultaSql: etapa.consultaSql,
    });
  }
  for (const passo of etapa.passos) walkPasso(passo, { ...breadcrumb, passo: passo.nome }, out);
}

/** Flattens every display/execution rule and data-origin configuration of ONE processo seletivo
 *  into a trail list, in the order the elements appear in the builder. */
export function extractLogicTrails(doc: DocumentacaoPS): LogicTrailDoc {
  const trilhas: TrilhaEntry[] = [];
  for (const etapa of doc.etapas) walkEtapa(etapa, trilhas);
  return { tituloPortal: doc.tituloPortal, idPs: doc.idPs, trilhas };
}

/** Same idea as `extractLogicTrails`, but for the portal-level "Geral"/"Consultas"/"Integrações"
 *  overview — no etapa/passo tree here, so each section gets its own pseudo-breadcrumb under
 *  "Geral do portal". */
export function extractPortalLogicTrails(overview: PortalOverviewSpec): TrilhaEntry[] {
  const out: TrilhaEntry[] = [];
  const { geral, consultas, integracoes } = overview;
  const geralBreadcrumb: TrilhaBreadcrumb = { etapa: "Geral do portal" };

  if (geral.popupLgpd) {
    const popup = geral.popupLgpd;
    const breadcrumb = { ...geralBreadcrumb, passo: "Pop-up LGPD" };
    if (popup.consultaSql.configurada) {
      out.push({ tipo: "origem-consulta-sql", breadcrumb, elementoAlimentado: popup.nome, configuradaEm: "Pop-up", consultaSql: popup.consultaSql });
    }
    for (const item of popup.itens) walkItem(item, breadcrumb, out);
  }

  const camposGerais: [string, typeof geral.campoRegistro][] = [
    ["Campo de código do registro", geral.campoRegistro],
    ["Campo de oferta de curso", geral.campoOfertaCurso],
    ["Campo de local de oferta", geral.campoLocalOferta],
  ];
  for (const [label, campo] of camposGerais) {
    if (!campo) continue;
    const breadcrumb = { ...geralBreadcrumb, passo: label };
    const dd = campo.detalhes.dados;
    if (dd.opcoesPredefinidas?.fonte === "TOTVS") {
      out.push({ tipo: "origem-campo-totvs", breadcrumb, elementoAlimentado: campo.nome, opcoesPredefinidas: dd.opcoesPredefinidas });
    }
    if (dd.fonteExterna) {
      out.push({ tipo: "origem-externa", breadcrumb, elementoAlimentado: campo.nome, fonteExterna: dd.fonteExterna });
    }
  }

  const consultasBreadcrumb = { ...geralBreadcrumb, passo: "Consultas TOTVS" };
  for (const c of consultas) {
    out.push({
      tipo: "origem-consulta-sql",
      breadcrumb: consultasBreadcrumb,
      elementoAlimentado: `${c.codigo} — ${c.descricao}`,
      configuradaEm: "Consulta do portal",
      consultaSql: { configurada: true, codColigada: c.coligada, codSistema: c.sistema, codConsulta: c.codigo, usaCache: c.usaCache, frequenciaCache: c.frequenciaCache, parametros: c.parametros },
    });
  }

  const integracoesBreadcrumb = { ...geralBreadcrumb, passo: "Integrações" };
  for (const i of integracoes) {
    out.push({
      tipo: "origem-consulta-sql",
      breadcrumb: integracoesBreadcrumb,
      elementoAlimentado: `[${i.posicao}] ${i.query} — ${i.descricao}`,
      configuradaEm: "Integração do portal",
      consultaSql: { configurada: true, codColigada: i.coligada, codSistema: i.sistema, codConsulta: i.query, usaCache: false, parametros: [] },
    });
  }

  return out;
}

/** "Etapa > Passo > Agrupamento > ... [> Botão[ > Ação/Encaminhamento]]" — the single readable
 *  string every renderer (markdown/html/docx) uses to show where a trail lives. */
export function breadcrumbPath(b: TrilhaBreadcrumb): string {
  return [b.etapa, b.passo, ...(b.itens ?? []), b.botao, b.acao, b.encaminhamento].filter((p): p is string => !!p).join(" > ");
}
