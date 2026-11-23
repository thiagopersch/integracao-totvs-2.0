import type { CompareStatus } from "./types"

export const STATUS_LABELS: Record<CompareStatus, string> = {
  igual: "Igual",
  diferente: "Diferente",
  so_a: "Só em A",
  so_b: "Só em B",
}

export const CATEGORIA_LABELS: Record<string, string> = {
  campo: "Campo",
  texto: "Texto",
  agrupamento: "Agrupamento",
  botao: "Botão",
  cep: "CEP",
  html: "HTML",
  upload: "Upload",
  componente: "Componente",
}

/** Friendly PT-BR label per property segment — a flattened path like
 *  `detalhes.basico.placeholder` is shown as "Detalhes › Básico › Placeholder". Segments missing
 *  here fall back to `humanize`. */
const SEGMENT_LABELS: Record<string, string> = {
  // etapa / passo / feedback
  nome: "Nome",
  ativa: "Ativa",
  descricao: "Descrição",
  logicaExibicao: "Lógica de exibição",
  consultaSql: "Consulta SQL",
  condicao: "Condição",
  conclusivo: "Conclusivo",
  ordem: "Ordem",
  // consulta / fonte de dados
  configurada: "Configurada",
  codColigada: "Coligada",
  codSistema: "Sistema",
  codConsulta: "Código da consulta",
  usaCache: "Usa cache",
  frequenciaCache: "Frequência do cache",
  parametros: "Parâmetros",
  contexto: "Contexto",
  campoVinculado: "Campo vinculado",
  campoSistema: "Campo do sistema",
  valorFixo: "Valor fixo",
  // lógica
  logica: "Lógica de exibição",
  acao: "Ação",
  regras: "Regras",
  campo: "Campo",
  regra: "Regra",
  valor: "Valor",
  // item
  categoria: "Categoria",
  tipo: "Tipo",
  classeCss: "Classe CSS",
  padding: "Espaçamento (padding)",
  larguraMaxima: "Largura máxima",
  alturaMaxima: "Altura máxima",
  alinhamento: "Alinhamento",
  direcao: "Direção",
  horizontal: "Horizontal",
  vertical: "Vertical",
  background: "Fundo",
  cor: "Cor",
  possuiImagemVinculada: "Imagem vinculada",
  cssCodigo: "Código CSS",
  integracaoTotvs: "Integração TOTVS",
  integracaoRubeus: "Integração Rubeus",
  tabela: "Tabela",
  sentenca: "Sentença",
  coluna: "Coluna",
  nomeAlternativo: "Nome alternativo",
  chave: "Identificador (key)",
  nomeSistema: "Campo do sistema",
  obrigatorio: "Obrigatório",
  detalhes: "Detalhes",
  identidade: "Identidade",
  tipoCampo: "Tipo do campo",
  tabelaProcessoSeletivo: "Tabela do processo seletivo",
  multivalorado: "Multivalorado",
  ativada: "Ativada",
  ativado: "Ativado",
  basico: "Básico",
  rotulo: "Rótulo",
  placeholder: "Placeholder",
  posicaoRotulo: "Posição do rótulo",
  transformarTexto: "Transformar texto",
  dica: "Dica",
  mascara: "Máscara",
  sufixo: "Sufixo",
  prefixo: "Prefixo",
  desabilitar: "Desabilitar",
  esconder: "Esconder",
  esconderRotulo: "Esconder rótulo",
  minOpcoes: "Mínimo de opções",
  maxOpcoes: "Máximo de opções",
  validacoes: "Validações",
  mensagem: "Mensagem",
  codigo: "Código",
  inverter: "Inverter",
  dados: "Dados",
  tipoValorPadrao: "Tipo do valor padrão",
  valorPadrao: "Valor padrão",
  fonteExterna: "Fonte externa",
  tipoEnvio: "Tipo de envio",
  link: "Link",
  salvaAutomaticamente: "Salva automaticamente",
  enviaParametros: "Envia parâmetros",
  opcoesPredefinidas: "Opções predefinidas",
  fonte: "Fonte",
  consultaConfigurada: "Consulta configurada",
  opcoesManuais: "Opções manuais",
  label: "Rótulo",
  value: "Valor",
  somenteLeitura: "Somente leitura",
  propriedades: "Propriedades",
  vinculos: "Vínculos",
  agrupamentoOculto: "Agrupamento oculto",
  motivoOculto: "Motivo (oculto)",
  nomeComponente: "Nome do componente",
  tema: "Tema",
  corBotao: "Cor do botão",
  corTexto: "Cor do texto",
  usaCorInstitucional: "Usa cor institucional",
  temIcone: "Tem ícone",
  escondido: "Escondido",
  salvaDados: "Salva dados",
  fecharPopup: "Fecha pop-up",
  redirecionaUsuario: "Redireciona usuário",
  acoesPrimeiroPlano: "Ações (1º plano)",
  acoesSegundoPlano: "Ações (2º plano)",
  titulo: "Título",
  plano: "Plano",
  grupo: "Grupo",
  tipoAcao: "Tipo de ação",
  mensagemErro: "Mensagem de erro",
  acaoParametrizada: "Ação parametrizada",
  dataserver: "Dataserver",
  colunas: "Colunas",
  correspondente: "Correspondente",
  camposConfigurados: "Campos configurados",
  eventos: "Eventos",
  pessoaVinculada: "Pessoa vinculada",
  identificadorContato: "Identificador do contato",
  tipoContato: "Tipo do contato",
  alterarContatoPrincipal: "Altera contato principal",
  fonteDados: "Fonte de dados",
  encaminhamentos: "Encaminhamentos",
  destino: "Destino",
  novaAba: "Nova aba",
  popupDetalhe: "Pop-up",
  paginaDetalhe: "Página",
  permiteFechar: "Permite fechar",
  itens: "Itens",
  campoCepVinculado: "Campo CEP vinculado",
  editavel: "Editável",
  tipoHtml: "Tipo de HTML",
  conteudoHtml: "Conteúdo HTML",
  tamanhoMaximoMb: "Tamanho máximo (MB)",
  multiplosArquivos: "Múltiplos arquivos",
  extensoesBloqueadas: "Extensões bloqueadas",
  camposVinculadosUpload: "Campos vinculados",
  papel: "Papel",
}

function humanize(segment: string): string {
  const spaced = segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase()
}

/** `acoesPrimeiroPlano[1].parametros[0].nome` -> "Ações (1º plano) #2 › Parâmetros #1 › Nome". */
export function propLabel(path: string): string {
  return path
    .split(".")
    .map((seg) => {
      const m = /^([^[]+)((?:\[\d+\])*)$/.exec(seg)
      if (!m) return seg
      const base = SEGMENT_LABELS[m[1]] ?? humanize(m[1])
      const idx = [...m[2].matchAll(/\[(\d+)\]/g)].map((x) => ` #${Number(x[1]) + 1}`).join("")
      return base + idx
    })
    .join(" › ")
}
