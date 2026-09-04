/** Documentation model for a "Processo Seletivo" (selective process), mirroring the sections of
 *  the reference document (`[RB-33] [SENAI] - Documentação técnica_ Mapeamento da ficha.docx`):
 *  Etapa -> Lógica de exibição -> Descrição -> Passos (itens em ordem) -> Feedbacks.
 *
 *  Confirmed live against a real Token PS: fields/components inside a passo come from the
 *  `content` array of `POST /selected-stage/{idPs}`, and a button's action pipeline (the docx's
 *  "RB.PS.IM.007 | Pré-Inscrição: ..." narrative) comes from that same content item's
 *  `button_actions` (ordered groups of TOTVS/Rubeus actions) and `forwardData` (redirect actions). */

export interface IntegracaoTotvsSpec {
  tabela?: string;
  campo?: string;
  sentenca?: string;
}

/** Always present on an action — `configurada: false` (with the other fields absent) whenever
 *  codColigada/codSistema/codConsulta aren't ALL filled, per explicit instruction: an action
 *  without a real TOTVS consulta must say so plainly rather than showing a half-empty block. */
export type FonteDadosSpec =
  | { configurada: false }
  | {
      configurada: true;
      codColigada: string;
      codSistema: string;
      codConsulta: string;
      usaCache: boolean;
      frequenciaCache?: string;
      contexto: { nome: string; campoVinculado?: string }[];
    };

export interface RegraLogicaItem {
  campo: string;
  regra: string;
  valor?: string;
}

export type PlanoExecucao = "primeiro" | "segundo";

/** One "Nome campo / Tipo do campo / Campo sistema" row from the action's own parameter table —
 *  `fixed_param` on the raw record decides whether it's bound to a system field or a literal
 *  fixed value (confirmed live against the builder's own "Enviar parâmetros" UI). */
export interface ParametroAcaoSpec {
  nome: string;
  tipo: "Campo do sistema" | "Valor fixo";
  campoSistema?: string;
  valorFixo?: string;
}

/** One "Coluna / Tabela / Correspondente" row — the field mapping table shown for a Salvar
 *  Dados/Executar processo action (confirmed live: the action's own `fields[]`). */
export interface ColunaDataserverSpec {
  coluna: string;
  tabela?: string;
  correspondente: string;
}

/** "Realizar Consulta" / "Salvar Dados" / "Executar processo" (action_type_id 1/2/3, confirmed
 *  live against `list-totvs-action-types`) or "Ação Rubeus" (a differently-shaped record — no
 *  action_type_id from that catalog, identified by its own group type instead). */
export type TipoAcao = "Realizar consulta" | "Salvar dados" | "Executar processo" | "Ação Rubeus" | "Gerar relatório" | "Integração";

export interface EventoRubeusSpec {
  codigo: string;
  descricao?: string;
}

export interface PessoaVinculadaSpec {
  identificadorContato?: string;
  tipoContato?: string;
  alterarContatoPrincipal: boolean;
}

export interface AcaoBotaoSpec {
  ordem: number;
  plano: PlanoExecucao;
  grupo: string; // e.g. "Ações TOTVS" / "Ações Rubeus" / "Integrações" / "Gerar relatório"
  tipoAcao: TipoAcao;
  descricao: string;
  mensagemErro?: string;
  acaoParametrizada?: string; // e.g. "RB.PS.IM.007" — the consulta code, only for "Realizar consulta"
  dataserver?: string; // resolved name, only for "Salvar dados"/"Executar processo"
  colunas?: ColunaDataserverSpec[]; // only for "Salvar dados"/"Executar processo"
  camposConfigurados: string[]; // "Realizar consulta"'s own returned/bound fields
  parametros: ParametroAcaoSpec[];
  eventos?: EventoRubeusSpec[]; // only for "Ação Rubeus"
  pessoaVinculada?: PessoaVinculadaSpec; // only for "Ação Rubeus"
  logica?: RegraLogicaItem[];
  ativada: boolean;
  /** Only rendered for action types that aren't themselves already a consulta (a "Realizar
   *  consulta" action's own coligada/sistema/consulta/parâmetros already covers this — showing a
   *  second "Fonte de dados" block would just repeat it, per explicit instruction). */
  fonteDados?: FonteDadosSpec;
}

export interface EncaminhamentoSpec {
  /** `redirect_type_id` (1-9) friendly label, e.g. "Abrir pop-up"/"Link externo" — confirmed live
   *  against the builder's own "Destino" dropdown. */
  tipo: string;
  destino: string;
  novaAba: boolean;
  /** Only present for "Link externo" (`redirect_type_id` 5) when `use_parameters` is set — same
   *  Campo do sistema/Valor fixo shape as an action's own parâmetros. */
  parametros?: ParametroAcaoSpec[];
  logica?: RegraLogicaItem[];
}

export interface ValidacaoRegra {
  tipo: string;
  ativado: boolean;
  mensagem?: string;
  valor?: string;
  codigo?: string;
  inverter?: boolean;
}

export interface CampoIdentidade {
  tipoCampo: string;
  tabelaProcessoSeletivo?: "Pessoa" | "Inscrição";
  multivalorado: boolean;
  integracaoRubeus?: { ativada: boolean; tabela?: string; coluna?: string };
  integracaoTotvs?: { ativada: boolean; tabela?: string; campo?: string; nomeAlternativo?: string };
}

export interface CampoBasico {
  rotulo?: string;
  placeholder?: string;
  posicaoRotulo?: string;
  transformarTexto?: string;
  descricao?: string;
  dica?: string;
  mascara?: string;
  sufixo?: string;
  prefixo?: string;
  classeCss?: string;
  desabilitar: boolean;
  esconder: boolean;
  esconderRotulo: boolean;
}

export interface CampoDados {
  tipoValorPadrao?: "simples" | "dinamico" | "externa";
  valorPadrao?: string;
  fonteExterna?: {
    tipoEnvio?: string;
    link?: string;
    salvaAutomaticamente: boolean;
    enviaParametros: boolean;
    parametros: { nome: string; regra?: string; campoVinculado?: string }[];
  };
  opcoesPredefinidas?: {
    ativado: boolean;
    fonte?: "TOTVS" | "Fonte externa" | "Manual";
    consultaConfigurada: boolean;
    opcoesManuais?: { label: string; value: string }[];
  };
  somenteLeitura: boolean;
}

export interface CampoDetalhado {
  identidade: CampoIdentidade;
  basico: CampoBasico;
  multivalorado?: { minOpcoes?: number; maxOpcoes?: number };
  validacoes: ValidacaoRegra[];
  dados: CampoDados;
  propriedades: Record<string, string>;
  vinculos: string[];
}

export type ItemCategoria = "campo" | "texto" | "agrupamento" | "botao" | "cep" | "html" | "upload" | "componente";

/** A single node in a passo's ordered item tree — one shape covering every component type found
 *  on a real process; only the fields relevant to `categoria` are populated. Containers/column
 *  groups nest their children in `filhos`, in the order configured. */
export interface ItemSpec {
  categoria: ItemCategoria;
  nome: string;
  tipo: string;
  classeCss?: string;
  padding?: string;
  larguraMaxima?: string;
  alinhamento?: string;
  temBackground?: boolean;
  corBackground?: string;
  temImagemBackground?: boolean;
  cssCodigo?: string;
  logicaTexto?: string;
  logica?: RegraLogicaItem[];
  integracaoTotvs?: IntegracaoTotvsSpec;

  // categoria "campo"
  obrigatorio?: boolean;
  regras?: string[];
  detalhes?: CampoDetalhado;

  // categoria "agrupamento"
  numColunas?: number;
  larguraColuna?: string;
  larguraPorColuna?: string[];
  filhos?: ItemSpec[];

  // categoria "botao"
  nomeComponente?: string; // internal reference name (`name`) — distinct from `nome`, which is the visible label
  tema?: string; // friendly name, e.g. "Elevado (btn-raised)"
  corBotao?: string;
  corTexto?: string;
  usaCorInstitucional?: boolean;
  temIcone?: boolean;
  escondido?: boolean;
  salvaDados?: boolean;
  fecharPopup?: boolean;
  redirecionaUsuario?: boolean;
  acoesPrimeiroPlano?: AcaoBotaoSpec[];
  acoesSegundoPlano?: AcaoBotaoSpec[];
  encaminhamentos?: EncaminhamentoSpec[];

  // categoria "cep"
  campoCepVinculado?: string;
  editavel?: boolean;

  // categoria "html"
  tipoHtml?: "script" | "html";
  conteudoHtml?: string;

  // categoria "upload"
  tamanhoMaximoMb?: number;
  multiplosArquivos?: boolean;
  extensoesBloqueadas?: boolean;
  camposVinculadosUpload?: { papel: string; campo: string }[];
}

export interface PassoSpec {
  nome: string;
  itens: ItemSpec[];
}

export interface FeedbackSpec {
  nome: string;
  condicao: string;
  conclusivo: boolean;
}

export interface EtapaSpec {
  nome: string;
  ativa: boolean;
  logicaExibicao: string;
  descricao: string;
  fontesDados: string[];
  passos: PassoSpec[];
  feedbacks: FeedbackSpec[];
}

export interface DocumentacaoPS {
  tituloPortal: string;
  idPs: string;
  etapas: EtapaSpec[];
}

export interface StyleConfig {
  titleColor: string;
  titleFont: string;
  stageColor: string;
  subheadingColor: string;
  bodyColor: string;
  bodyFont: string;
}

export const DEFAULT_STYLE: StyleConfig = {
  titleColor: "#1fa7a6",
  titleFont: "Poppins",
  stageColor: "#666666",
  subheadingColor: "#666666",
  bodyColor: "#1a1a1a",
  bodyFont: "Poppins",
};

export const FONT_OPTIONS = ["Poppins", "Roboto", "Arial", "Times New Roman", "Calibri"] as const;
