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

/** Only ever populated when codColigada + codSistema + codConsulta are ALL present on the raw
 *  action/field — per explicit instruction, a partially-configured source is not reported. */
export interface FonteDadosSpec {
  codColigada: string;
  codSistema: string;
  codConsulta: string;
  usaCache: boolean;
  frequenciaCache?: string;
  contexto: { nome: string; campoVinculado?: string }[];
}

export interface RegraLogicaItem {
  campo: string;
  regra: string;
  valor?: string;
}

export interface AcaoBotaoSpec {
  ordem: number;
  grupo: string; // e.g. "Ações TOTVS" / "Ações Rubeus"
  descricao: string;
  mensagemErro?: string;
  acaoParametrizada?: string; // e.g. "RB.PS.IM.007.CST"
  camposConfigurados: string[];
  logica?: RegraLogicaItem[];
  ativada: boolean;
  fonteDados?: FonteDadosSpec;
}

export interface EncaminhamentoSpec {
  destino: string;
  novaAba: boolean;
  logica?: RegraLogicaItem[];
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
  fonteDados?: FonteDadosSpec;

  // categoria "campo"
  obrigatorio?: boolean;
  regras?: string[];

  // categoria "agrupamento"
  numColunas?: number;
  larguraColuna?: string;
  filhos?: ItemSpec[];

  // categoria "botao"
  tema?: string;
  corBotao?: string;
  corTexto?: string;
  usaCorInstitucional?: boolean;
  temIcone?: boolean;
  escondido?: boolean;
  salvaDados?: boolean;
  redirecionaUsuario?: boolean;
  acoes?: AcaoBotaoSpec[];
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
