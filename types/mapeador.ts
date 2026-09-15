export type MapeadorCampoTipo =
  | "texto"
  | "select"
  | "radio"
  | "check"
  | "data"
  | "pagamento_valor"
  | "pagamento_formas"
  | "botao"
  | "documento_upload"
  | "titulo_pagina"
  | "label_destaque"
  | "texto_informativo"
  | "popup"
  | "condicional"
  | "divisor"

export const MAPEADOR_CAMPO_TIPO_LABELS: Record<MapeadorCampoTipo, string> = {
  texto: "Campo - Texto",
  select: "Campo - Select",
  radio: "Campo - Radio",
  check: "Campo - Check",
  data: "Campo - Data",
  pagamento_valor: "[Pagamento] Valor a pagar (destaque)",
  pagamento_formas: "[Pagamento] Formas de pagamento",
  botao: "Botão",
  documento_upload: "[Documento] Upload",
  titulo_pagina: "[Título] Destaque de página",
  label_destaque: "[Label] Destaque",
  texto_informativo: "Texto informativo",
  popup: "Pop-up",
  condicional: "[Condicional]",
  divisor: "Divisor (quebra de linha)",
}

export interface MapeadorCampo {
  id: string
  tipo: MapeadorCampoTipo
  label: string
  obrigatorio?: boolean
  opcoesLista?: string[]
  condicaoExibicao?: string
  acaoDestinoEtapaId?: string | null
}

export type MapeadorPassoTipo = "passo" | "popup" | "pagina"

export interface MapeadorPasso {
  id: string
  tipo: MapeadorPassoTipo
  titulo: string
  campos: MapeadorCampo[]
}

export type CamposPorEtapa = MapeadorPasso[]

export interface MapeadorInformacoesAdicionais {
  idProcessoSeletivo?: string
  idRelatorioContrato?: string
  classificacaoConvocacao?: string
  criterioClassificacao?: string
  agendamento?: string
}

export interface MapeadorPrototipoConfig {
  tema?: string
  corMarca?: string
  corBarra?: string
  visualizacao?: "desktop" | "mobile"
}

export interface MapeadorEtapaDTO {
  id: string
  ordem: number
  nome: string
  condicao: string | null
  regras: string | null
  camposPorEtapa: CamposPorEtapa
}

export interface MapeadorProjetoDTO {
  id: string
  nome: string
  informacoesAdicionais: MapeadorInformacoesAdicionais
  prototipoConfig: MapeadorPrototipoConfig
  etapas: MapeadorEtapaDTO[]
}

export interface MapeadorProjetoSummary {
  id: string
  nome: string
  etapasCount: number
  updatedAt: string
}
