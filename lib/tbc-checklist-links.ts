import type { ChecklistTableResult } from "@/actions/integrations/tbc-checklist"
import type { TbcChecklistLink } from "@/schemas/tbc-checklist.schema"

/**
 * Links between the Data Servers of a checklist: a Data Server linked to others ("parents") only
 * loads the rows matching every parent's loaded rows, by pairs of main-table columns (e.g.
 * SPSAreaOfertada.IDAREAINTERESSE → SPSAreaInteresse.IDAREAINTERESSE), on top of the processo's
 * CODCOLIGADA/IDPS, and the generated SQL joins through them. A parent sits above its children in
 * the checklist's order (so links never form a cycle) and is loaded before them.
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

/** Codes that can filter `code`: the ones above it in the checklist's order (never itself). */
export function linkableParents(dataservers: LinkedDataserver[], code: string): string[] {
  const index = dataservers.findIndex((d) => d.dataserverCode === code)
  return dataservers.slice(0, Math.max(index, 0)).map((d) => d.dataserverCode)
}

/** A link whose parent is not above its child in the order. */
export type OrderProblem = { child: string; parent: string }

/** Every link whose parent sits below (or outside) its child in `dataservers`' order. */
export function orderProblems(dataservers: LinkedDataserver[]): OrderProblem[] {
  const position = new Map(dataservers.map((d, i) => [d.dataserverCode, i]))
  return dataservers.flatMap((d, i) =>
    d.links.filter((l) => (position.get(l.parentCode) ?? -1) > i).map((l) => ({ child: d.dataserverCode, parent: l.parentCode }))
  )
}

/** Problems of `next` that `previous` didn't have — what a reorder would break. */
export function newOrderProblems(previous: LinkedDataserver[], next: LinkedDataserver[]): OrderProblem[] {
  const known = new Set(orderProblems(previous).map((p) => `${p.child}|${p.parent}`))
  return orderProblems(next).filter((p) => !known.has(`${p.child}|${p.parent}`))
}

/** The order to load in: the checklist's, but a Data Server only after the parents it has among
 *  `entries` — so a link left from before (parent below its child) still loads. */
export function loadOrder<T extends LinkedDataserver>(entries: T[]): T[] {
  const pending = [...entries]
  const result: T[] = []
  const placed = new Set<string>()
  const inEntries = new Set(entries.map((e) => e.dataserverCode))
  while (pending.length) {
    const ready = pending.findIndex((e) => e.links.every((l) => placed.has(l.parentCode) || !inEntries.has(l.parentCode)))
    // No cycle is ever saved; if one shows up anyway, keep the checklist's order.
    const [next] = pending.splice(ready === -1 ? 0 : ready, 1)
    result.push(next)
    placed.add(next.dataserverCode)
  }
  return result
}

/** The processo's values (CODCOLIGADA/IDPS) that still filter a linked Data Server: all of them,
 *  except a column a link fills from a differently named parent column (e.g. CODCOLIGADA from
 *  CODCOLIGADAHABFILIAL — the habilitação may belong to another coligada). */
export function contextValues(pkValues: Record<string, string>, links: TbcChecklistLink[]): Record<string, string> {
  const remapped = links.flatMap((l) => l.fields.filter((f) => !sameName(f.parent, f.child)).map((f) => f.child))
  return Object.fromEntries(Object.entries(pkValues).filter(([name]) => !remapped.some((c) => sameName(c, name))))
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
