import type { ChecklistFieldRow } from "@/actions/integrations/tbc-checklist"

type FieldGroupConfig = {
  name: string
  order: number
  matchers: string[]
}

export type FieldGroup = {
  name: string
  fields: ChecklistFieldRow[]
}

const OTHERS_GROUP_NAME = "Outros campos"

/**
 * Best-effort mapping from a Data Server's field captions to the TOTVS RM screen tab they belong
 * to (GetSchema has no such metadata — TOTVS never exposes which form tab a field lives on). Built
 * from screenshots of the real "Processo Seletivo" registration screen; matchers are checked as
 * normalized (lowercase, no accents) substrings against the field caption, first group to match
 * wins. May need tweaking once verified against the live schema.
 */
export const CHECKLIST_FIELD_GROUPS: Record<string, FieldGroupConfig[]> = {
  EduPSProcessoSeletivoData: [
    {
      name: "Identificação",
      order: 1,
      matchers: [
        "ativo",
        "codigo do processo seletivo",
        "nome do processo seletivo",
        "categoria do processo seletivo",
        "utiliza venda online",
        "valor da inscricao",
        "maximo de inscricoes",
        "aceita treineiro",
        "utiliza necessidades especiais",
        "visivel no portal de inscricoes",
        "visivel para todas as filiais",
        "gerar log de alteracoes de status",
      ],
    },
    {
      name: "Calendário",
      order: 2,
      matchers: [
        "inicio das inscricoes",
        "termino das inscricoes",
        "inicio da selecao",
        "termino da selecao",
        "inicio da divulgacao",
        "termino da divulgacao",
      ],
    },
    {
      name: "Informações financeiras",
      order: 3,
      matchers: [
        "cliente/fornecedor",
        "tipo de documento",
        "historico",
        "moeda",
        "conta/caixa",
        "convenio",
        "filial do lancamento",
        "departamento do lancamento",
        "centro de custo",
        "natureza orcamentaria financeira",
        "tipo contabil",
        "evento contabil de inclusao",
        "baixar automaticamente lancamentos",
      ],
    },
    {
      name: "Parâmetros",
      order: 4,
      matchers: [
        "nome do portal de inscricoes",
        "utilizar senha para login",
        "carteira de identidade",
        "codigo do usuario",
        "criterios de busca",
        "aproveitar dados do cadastro",
        "campus/polo",
        "gravar os dados em letra maiuscula",
      ],
    },
    {
      name: "Venda online de cursos",
      order: 5,
      matchers: ["validar manualmente a entrega", "copiar arquivos de documentos"],
    },
    {
      name: "Campos complementares",
      order: 6,
      matchers: ["token de prova"],
    },
  ],
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

/**
 * Groups a table's fields by the TOTVS screen tab they most likely belong to, per
 * `CHECKLIST_FIELD_GROUPS`. Returns `null` when there's no config for `dataserverCode` — callers
 * should fall back to a flat, ungrouped grid in that case (nothing breaks for Data Servers not
 * mapped yet).
 */
export function groupChecklistFields(dataserverCode: string, fields: ChecklistFieldRow[]): FieldGroup[] | null {
  const config = CHECKLIST_FIELD_GROUPS[dataserverCode]
  if (!config) return null

  const sortedConfig = [...config].sort((a, b) => a.order - b.order)
  const groups: FieldGroup[] = sortedConfig.map((g) => ({ name: g.name, fields: [] }))
  const others: ChecklistFieldRow[] = []

  for (const field of fields) {
    const caption = normalize(field.caption)
    const matchIndex = sortedConfig.findIndex((g) => g.matchers.some((m) => caption.includes(normalize(m))))
    if (matchIndex === -1) {
      others.push(field)
    } else {
      groups[matchIndex].fields.push(field)
    }
  }

  const nonEmptyGroups = groups.filter((g) => g.fields.length > 0)
  if (others.length) {
    nonEmptyGroups.push({ name: OTHERS_GROUP_NAME, fields: others })
  }
  return nonEmptyGroups
}

export { OTHERS_GROUP_NAME }
