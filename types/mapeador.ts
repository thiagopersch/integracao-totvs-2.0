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
  | "agrupamento"

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
  agrupamento: "Agrupamento (colunas)",
}

/** Column span out of a 12-column grid (Bootstrap-style): 12 = full row, 6 = half, 4 = a third, 3 = a quarter, etc. */
export type MapeadorCampoLargura = number

export const MAPEADOR_LARGURA_DEFAULT: MapeadorCampoLargura = 12

/**
 * Accepts the current 1–12 column value and transparently upgrades data saved under the old
 * fixed-percentage scheme ("25"/"33"/"50"/"100") so existing projects keep rendering correctly.
 */
export function normalizeLargura(value: unknown): MapeadorCampoLargura {
  if (typeof value === "number" && Number.isFinite(value)) return Math.min(12, Math.max(1, Math.round(value)))
  switch (value) {
    case "25":
      return 3
    case "33":
      return 4
    case "50":
      return 6
    case "100":
      return 12
    default:
      return MAPEADOR_LARGURA_DEFAULT
  }
}

export interface MapeadorCampo {
  id: string
  tipo: MapeadorCampoTipo
  label: string
  obrigatorio?: boolean
  opcoesLista?: string[]
  /** Human-readable description of the display condition, derived from condicaoRefCampoId/condicaoRefValor — kept for imported templates that only ever had free text. */
  condicaoExibicao?: string
  /** Id of the field (within the same passo) this field's visibility depends on. */
  condicaoRefCampoId?: string | null
  /** Value/state of the referenced field that makes this field visible (boolean for a plain check, or one of its opcoesLista). */
  condicaoRefValor?: string | boolean
  acaoDestinoEtapaId?: string | null
  /** Column span (1-12) in the Protótipo visual grid — set directly in the campo editor or via the "Ajustar layout" click-to-resize mode. Read through normalizeLargura(). */
  largura?: MapeadorCampoLargura
  /** Forces the field onto its own row in the Protótipo visual grid, with extra top spacing, regardless of its largura. Set via the "Ajustar layout" click-to-resize mode. */
  novaLinha?: boolean
  /** Text alignment for heading/text content types (titulo_pagina, label_destaque, texto_informativo). */
  alinhamento?: "left" | "center" | "right"
  /** Text color (any CSS color) for heading/text content types (titulo_pagina, label_destaque, texto_informativo). */
  cor?: string
  /** Columns (1-4) for a tipo "agrupamento" campo — the group's own largura/novaLinha still place it within the parent grid, like any other campo. */
  colunas?: MapeadorColuna[]
}

/** One column inside a tipo "agrupamento" campo: its own width (same 1-12 scale as campo.largura) and an ordered list of nested campos. Agrupamento campos cannot nest inside a coluna (v1 constraint, enforced in the editor). */
export interface MapeadorColuna {
  id: string
  largura: MapeadorCampoLargura
  campos: MapeadorCampo[]
}

/** Recursively finds the campo with the given id anywhere in the tree (including inside agrupamento colunas) and applies patch to it, leaving everything else untouched. Used by the "Ajustar layout" click-to-resize mode, which needs to reach fields nested inside a coluna. */
export function updateCampoDeep(campos: MapeadorCampo[], campoId: string, patch: Partial<MapeadorCampo>): MapeadorCampo[] {
  return campos.map((c) => {
    if (c.id === campoId) return { ...c, ...patch }
    if (c.tipo === "agrupamento" && c.colunas) {
      return { ...c, colunas: c.colunas.map((col) => ({ ...col, campos: updateCampoDeep(col.campos, campoId, patch) })) }
    }
    return c
  })
}

/** Recursively expands any tipo "agrupamento" campo into its nested campos (depth-first), so flat consumers (exports, summaries) see every real field instead of one opaque "agrupamento" entry. */
export function flattenCampos(campos: MapeadorCampo[]): MapeadorCampo[] {
  return campos.flatMap((c) => (c.tipo === "agrupamento" ? (c.colunas ?? []).flatMap((col) => flattenCampos(col.campos)) : [c]))
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
  /** Some Padrão Rubeus templates (e.g. Prova Online) carry extra process-specific keys beyond the fixed ones above. */
  [key: string]: string | undefined
}

export type MapeadorFeedbackTipo = "positivo" | "negativo" | "neutro"

export const MAPEADOR_FEEDBACK_TIPO_LABELS: Record<MapeadorFeedbackTipo, string> = {
  positivo: "Conclusivo · Positivo",
  negativo: "Conclusivo · Negativo",
  neutro: "Intermediário · Neutro",
}

export interface MapeadorFeedback {
  /** "Status exibido" — ex.: Concluída, Reprovado. */
  feedback: string
  /** "Quando aparece" — a lógica/gatilho em texto livre. */
  logic: string
  tipo: MapeadorFeedbackTipo | string
  botaoNoPortal?: boolean
  botaoLabel?: string
}

export type MapeadorGerarPara = "atual" | "todos"

export type MapeadorIdentidadeOrigem = "manual" | "cliente"

export interface MapeadorPrototipoConfig {
  temaId?: string | null
  corMarca?: string
  corBarra?: string
  visualizacao?: "desktop" | "mobile"
  logoUrl?: string | null
  bgImageUrl?: string | null
  /** Where corMarca/logoUrl/bgImageUrl came from — "cliente" means they were snapshotted from a Client's visual identity at selection time (see lib/mapeador/cliente-identidade.ts for drift detection). */
  origem?: MapeadorIdentidadeOrigem
  clienteId?: string | null
  /** Inline text overrides from the "Editar textos" click-to-edit mode, keyed by a fixed identifier (e.g. "btn.avancar"). */
  textos?: Record<string, string>
  gerarPara?: MapeadorGerarPara
  exportVisualizacao?: "desktop" | "mobile"
}

export interface MapeadorTemaConfig {
  corMarca?: string
  corBarra?: string
  campoCor?: string
  campoRaio?: number
  botaoCor?: string
  botaoRaio?: number
  logoUrl?: string | null
  bgImageUrl?: string | null
  /** Where corMarca/logoUrl/bgImageUrl came from — "cliente" means they were snapshotted from a Client's visual identity at save time. */
  origem?: MapeadorIdentidadeOrigem
  clienteId?: string | null
}

export interface MapeadorTemaDTO {
  id: string
  nome: string
  config: MapeadorTemaConfig
}

export interface MapeadorEtapaDTO {
  id: string
  ordem: number
  nome: string
  condicao: string | null
  regras: string | null
  camposPorEtapa: CamposPorEtapa
  feedbacks: MapeadorFeedback[]
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

export interface MapeadorTemplateSummary {
  id: string
  nome: string
  etapasCount: number
  itensCount: number
  /** "rubeus" = one of the 6 static built-in templates; "modelo" = saved by a user from a project ("Salvar como modelo"). */
  origem: "rubeus" | "modelo"
}
