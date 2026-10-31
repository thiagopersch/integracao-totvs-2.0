import type { ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import type { TbcChecklistLink } from "@/schemas/tbc-checklist.schema"

/**
 * Links between the Data Servers of a checklist: a Data Server linked to others ("parents") only
 * loads the rows matching every parent's loaded rows, by pairs of main-table columns (e.g.
 * SPSAreaOfertada.IDAREAINTERESSE → SPSAreaInteresse.IDAREAINTERESSE), and the generated SQL joins
 * through them. Links never form a cycle.
 */

export type LinkFieldPair = TbcChecklistLink["fields"][number]

/** Most value tuples one link sends as filtro — a parent never loads more than 50 rows anyway. */
export const MAX_LINK_TUPLES = 200

/** A table as far as link fields go — `SchemaTable` and `ChecklistTableMeta` both fit. */
type LinkTable = { fields: { name: string; isPrimaryKey: boolean }[] }

type LinkedDataserver = { dataserverCode: string; links: TbcChecklistLink[] }

const sameName = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

const KEY_NAME = /^(ID|COD)/i

/** Same-named columns of the two main tables that are a primary key on either side (CODCOLIGADA,
 *  IDPS, IDAREAINTERESSE…); with none, the same-named ID…/COD… columns. Never NOME, STATUS etc. */
export function suggestLinkFields(parentMain: LinkTable, childMain: LinkTable): LinkFieldPair[] {
  const shared = childMain.fields.flatMap((child) => {
    const parent = parentMain.fields.find((p) => sameName(p.name, child.name))
    return parent ? [{ parent: parent.name, child: child.name, pk: parent.isPrimaryKey || child.isPrimaryKey }] : []
  })
  const byKey = shared.filter((p) => p.pk)
  const pairs = byKey.length ? byKey : shared.filter((p) => KEY_NAME.test(p.child))
  return pairs.map(({ parent, child }) => ({ parent, child }))
}

/** Data Servers that depend on `code` — directly or through others — so can't be its parent. */
export function descendantsOf(dataservers: LinkedDataserver[], code: string): Set<string> {
  const result = new Set<string>()
  const stack = [code]
  while (stack.length) {
    const current = stack.pop()!
    for (const d of dataservers) {
      if (d.dataserverCode === code || result.has(d.dataserverCode)) continue
      if (d.links.some((l) => l.parentCode === current)) {
        result.add(d.dataserverCode)
        stack.push(d.dataserverCode)
      }
    }
  }
  return result
}

/** Codes `code` can be linked to without closing a cycle (never itself). */
export function linkableParents(dataservers: LinkedDataserver[], code: string): string[] {
  const blocked = descendantsOf(dataservers, code)
  return dataservers.map((d) => d.dataserverCode).filter((c) => c !== code && !blocked.has(c))
}

/** "CODCOLIGADA, IDAREAINTERESSE" — or "IDETAPA = ETAPA" for a pair whose names differ. */
export function linkFieldsLabel(fields: LinkFieldPair[]): string {
  return fields.map((f) => (sameName(f.parent, f.child) ? f.child : `${f.parent} = ${f.child}`)).join(", ")
}

/** Distinct value tuples of `fieldNames` in the parent's loaded rows — a row missing any of them
 *  is left out; no row (an `empty` result) gives none. */
export function linkTuples(result: ChecklistTableResult, fieldNames: string[]): string[][] {
  if (result.empty) return []
  const seen = new Set<string>()
  const tuples: string[][] = []
  for (const record of result.records) {
    const values = fieldNames.map((name) => record.fields.find((f) => sameName(f.name, name))?.valor.trim() ?? "")
    const key = JSON.stringify(values)
    if (values.some((v) => v === "") || seen.has(key)) continue
    seen.add(key)
    tuples.push(values)
  }
  return tuples
}
