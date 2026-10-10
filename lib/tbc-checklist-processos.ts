import type { ChecklistContext } from "@/actions/integrations/tbc-checklist"
import { rowValue } from "@/lib/tbc-checklist-records"

/** A processo seletivo as found in TOTVS — exactly what gets saved in the checklist. */
export type ProcessoSeletivoOption = {
  codColigada: number
  codFilial: number
  levelEducation: number
  idps: number
  name: string
}

type SchemaFieldLike = { name: string; isPrimaryKey: boolean }

const NAME_FIELD_PATTERN = /^(NOME|DESCRICAO)/i

/** Column holding the processo's name — first non-PK field whose name starts with NOME or DESCRICAO. */
export function findNameField(fields: SchemaFieldLike[]): string | undefined {
  return fields.find((f) => !f.isPrimaryKey && NAME_FIELD_PATTERN.test(f.name))?.name
}

function toInt(value: string | undefined): number | null {
  const text = value?.trim() ?? ""
  return /^-?\d+$/.test(text) ? Number(text) : null
}

/** Same-key processos (coligada + IDPS) are kept once; newest IDPS first. The filial and nível de
 *  ensino are the Contexto the search ran with — the one the processo will be loaded with later. */
export function toProcessoOptions(
  rows: Record<string, string>[],
  nameField: string | undefined,
  context: ChecklistContext
): ProcessoSeletivoOption[] {
  const byKey = new Map<string, ProcessoSeletivoOption>()
  for (const row of rows) {
    const codColigada = toInt(rowValue(row, "CODCOLIGADA"))
    const idps = toInt(rowValue(row, "IDPS"))
    if (codColigada === null || idps === null) continue
    const key = `${codColigada}-${idps}`
    if (byKey.has(key)) continue
    const name = (nameField ? rowValue(row, nameField) : undefined)?.trim()
    byKey.set(key, {
      codColigada,
      codFilial: context.branch,
      levelEducation: context.levelEducation,
      idps,
      name: name || `Processo seletivo ${idps}`,
    })
  }
  return Array.from(byKey.values()).sort((a, b) => b.idps - a.idps || b.codColigada - a.codColigada)
}

/** Key of a processo inside a checklist — the same coligada + IDPS is never saved twice. */
export const processoKey = (p: { codColigada: number; idps: number }) => `${p.codColigada}-${p.idps}`
