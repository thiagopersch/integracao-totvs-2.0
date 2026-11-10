import type { CampoDetalhado, DocumentacaoPS, ItemSpec, LogicaSpec, PortalOverviewSpec } from "../types"

/** Hand-built documentation model covering every branch the "detail options" touch: a campo with
 *  its own logic, an agrupamento with a nested campo/text, a botão with two ações (one with logic)
 *  plus an encaminhamento to a pop-up whose own content holds a campo. Used by the renderer tests. */

const logicaCampo: LogicaSpec = {
  acao: "Mostrar",
  condicao: "Se todas as regras corresponderem",
  regras: [{ campo: "Possui deficiência (316200)", regra: "É igual a", valor: "Sim" }],
}

const logicaAcao: LogicaSpec = {
  acao: "Executar",
  condicao: "Se alguma dessas regras corresponder",
  regras: [{ campo: "Forma de ingresso (316201)", regra: "É conhecido" }],
}

export const sampleDetalhes: CampoDetalhado = {
  identidade: { tipoCampo: "Texto", tabelaProcessoSeletivo: "Pessoa", multivalorado: false, integracaoTotvs: { ativada: true, tabela: "PPESSOA", campo: "NOME" } },
  basico: { rotulo: "Nome completo", placeholder: "Digite seu nome", desabilitar: false, esconder: false, esconderRotulo: false },
  validacoes: [{ tipo: "Obrigatório", ativado: true, mensagem: "Campo obrigatório" }],
  dados: { somenteLeitura: false },
  propriedades: {},
  vinculos: [],
}

const campoNome: ItemSpec = { categoria: "campo", nome: "Nome completo (316100)", tipo: "text", fieldId: 316100, detalhes: sampleDetalhes }
const campoLaudo: ItemSpec = { categoria: "campo", nome: "Laudo (316101)", tipo: "text", fieldId: 316101, logica: logicaCampo, detalhes: sampleDetalhes }
const textoAviso: ItemSpec = { categoria: "texto", nome: "Aviso", tipo: "text", conteudoHtml: "Leia com atenção", logica: logicaCampo }

const agrupamento: ItemSpec = {
  categoria: "agrupamento",
  nome: "Dados pessoais",
  tipo: "container",
  padding: "8px",
  logica: logicaCampo,
  camposAgrupados: [{ nome: "Laudo (316101)", logica: logicaCampo }, { nome: "Aviso" }],
  filhos: [campoLaudo, textoAviso],
}

const popupCampo: ItemSpec = { categoria: "campo", nome: "Aceite (316102)", tipo: "checkbox", fieldId: 316102, detalhes: sampleDetalhes }

const botao: ItemSpec = {
  categoria: "botao",
  nome: "Concluir",
  tipo: "button",
  nomeComponente: "btn-concluir",
  tema: "Elevado (btn-raised)",
  salvaDados: true,
  redirecionaUsuario: true,
  acoesPrimeiroPlano: [
    {
      ordem: 1,
      titulo: "[FV#155]: Atualizar escola anterior",
      plano: "primeiro",
      grupo: "Ações TOTVS",
      tipoAcao: "Realizar consulta",
      descricao: "",
      acaoParametrizada: "RB.PS.IM.007",
      camposConfigurados: ["Escola (316150)"],
      parametros: [{ nome: "ESCOLA", tipo: "Campo do sistema", campoSistema: "Escola (316150)" }],
      logica: logicaAcao,
      ativada: true,
    },
  ],
  acoesSegundoPlano: [
    {
      ordem: 2,
      plano: "segundo",
      grupo: "Ações TOTVS",
      tipoAcao: "Salvar dados",
      descricao: "",
      dataserver: "EduPSInscricaoData",
      colunas: [{ coluna: "NOME", tabela: "PPESSOA", correspondente: "Nome completo (316100)" }],
      camposConfigurados: [],
      parametros: [],
      ativada: false,
      fonteDados: { configurada: false },
    },
  ],
  encaminhamentos: [
    {
      tipo: "Abrir pop-up",
      destino: "Pop-up de aceite",
      novaAba: false,
      logica: logicaAcao,
      popupId: 99,
      popupDetalhe: { nome: "Pop-up de aceite", permiteFechar: true, itens: [popupCampo], consultaSql: { configurada: false } },
    },
  ],
}

export const sampleDoc: DocumentacaoPS = {
  tituloPortal: "Processo de teste",
  idPs: "5537",
  etapas: [
    {
      nome: "Inscrição",
      ativa: true,
      logicaExibicao: { regras: [] },
      descricao: "Etapa inicial",
      consultaSql: { configurada: false },
      passos: [{ nome: "Dados", itens: [campoNome, agrupamento, botao], consultaSql: { configurada: false } }],
      feedbacks: [{ nome: "Sucesso", condicao: "Inscrição concluída", conclusivo: true }],
    },
  ],
}

export const sampleOverview: PortalOverviewSpec = {
  idPortal: "3734",
  geral: {
    nome: "Portal de teste",
    titulo: "Inscrições",
    ativo: true,
    carregamentoInteligente: true,
    vlibrasAtivo: false,
    cabecalhoAtivo: false,
    campoOfertaCurso: { nome: "Curso (316300)", detalhes: sampleDetalhes },
    campoLocalOferta: { nome: "Local (316301)", detalhes: sampleDetalhes },
    tituloSelectInscricoes: "Inscrições",
    tituloBarraEtapas: "Etapas",
    tituloBarraPortalInscrito: "Portal",
  },
  consultas: [],
  scripts: { scriptBodyComCookies: false, scriptHeadComCookies: false },
  integracoes: [],
  seguranca: [],
  totvs: { tbc: "tbc", usuario: "u", codColigada: "1", codFilial: "1", codSistema: "S", codTipoCurso: "1" },
  warnings: [],
}
