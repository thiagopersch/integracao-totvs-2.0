import { breadcrumbPath } from "./logic-trail";
import type { TrilhaEntry } from "./types";

const sim = (v: boolean | undefined) => (v ? "Sim" : "Não");

/** One rule of a logic trail's "meio", already formatted — "campo → regra → valor". */
export interface TrilhaRowRule {
  campo: string;
  regra: string;
  valor?: string;
}

/** A flattened, renderer-agnostic view of one `TrilhaEntry` — built once here and consumed by the
 *  markdown/html/docx renderers, so the "what does this trail actually say" logic lives in one
 *  place and only the markup differs between exports. */
export interface TrilhaRow {
  /** "Etapa > Passo > ... > elemento" — início + meio do caminho. */
  breadcrumb: string;
  tipoLabel: string;
  /** Fim da trilha: o elemento afetado (lógica) ou alimentado (origem de dados). */
  elemento: string;
  /** Only for lógica entries. */
  acao?: string;
  condicao?: string;
  regras?: TrilhaRowRule[];
  /** Only for origem de dados entries — simple key/value summary of the source config. */
  meioLines: { label: string; value: string }[];
  /** Only for origem de dados entries with a parameter table (consulta/fonte). */
  parametros?: { nome: string; detalhe?: string }[];
}

export function buildTrilhaRow(entry: TrilhaEntry): TrilhaRow {
  const breadcrumb = breadcrumbPath(entry.breadcrumb);

  switch (entry.tipo) {
    case "logica-elemento":
    case "logica-acao":
      return {
        breadcrumb,
        tipoLabel: entry.tipo === "logica-elemento" ? "Lógica de exibição" : "Lógica de ação",
        elemento: entry.elementoAfetado,
        acao: entry.logica.acao ?? "não identificada",
        condicao: entry.logica.condicao ?? "não identificada",
        regras: entry.logica.regras,
        meioLines: [],
      };

    case "origem-consulta-sql": {
      const fonte = entry.consultaSql ?? entry.fonteDados;
      if (!fonte || !fonte.configurada) {
        return {
          breadcrumb,
          tipoLabel: "Origem de dados: Consulta SQL",
          elemento: entry.elementoAlimentado,
          meioLines: [{ label: "Configurada em", value: entry.configuradaEm }, { label: "Consulta", value: "Não há sentença SQL configurada" }],
        };
      }
      const meioLines = [
        { label: "Configurada em", value: entry.configuradaEm },
        { label: "Coligada", value: fonte.codColigada },
        { label: "Sistema", value: fonte.codSistema },
        { label: "Consulta", value: fonte.codConsulta },
        { label: "Cache", value: sim(fonte.usaCache) },
      ];
      if (fonte.usaCache) meioLines.push({ label: "Frequência do cache", value: fonte.frequenciaCache ?? "não informada" });
      const parametros =
        "parametros" in fonte
          ? fonte.parametros.map((p) => ({ nome: p.nome, detalhe: p.tipo === "Campo do sistema" ? p.campoSistema : p.valorFixo }))
          : fonte.contexto.map((c) => ({ nome: c.nome, detalhe: c.campoVinculado }));
      return { breadcrumb, tipoLabel: "Origem de dados: Consulta SQL", elemento: entry.elementoAlimentado, meioLines, parametros };
    }

    case "origem-campo-totvs": {
      const op = entry.opcoesPredefinidas;
      return {
        breadcrumb,
        tipoLabel: "Origem de dados: Campo TOTVS",
        elemento: entry.elementoAlimentado,
        meioLines: [
          { label: "Fonte", value: op.fonte ?? "não identificada" },
          { label: "Consulta SQL configurada", value: sim(op.consultaConfigurada) },
        ],
      };
    }

    case "origem-externa": {
      const fe = entry.fonteExterna;
      return {
        breadcrumb,
        tipoLabel: "Origem de dados: Fonte externa (API)",
        elemento: entry.elementoAlimentado,
        meioLines: [
          { label: "Tipo de envio", value: fe.tipoEnvio ?? "não informado" },
          { label: "Link", value: fe.link ?? "não informado" },
          { label: "Salva automaticamente", value: sim(fe.salvaAutomaticamente) },
          { label: "Envia parâmetros", value: sim(fe.enviaParametros) },
        ],
        parametros: fe.parametros.map((p) => ({ nome: p.nome, detalhe: p.campoVinculado ?? p.regra })),
      };
    }
  }
}
