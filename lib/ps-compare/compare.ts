import { normalizeText } from "@/lib/ps-docs/field-search"
import { describeEtapaDestino } from "@/lib/ps-docs/etapa-destino"
import type { DocumentacaoPS, EtapaDestinoSpec, EtapaSpec, FeedbackSpec, ItemSpec, PassoSpec } from "@/lib/ps-docs/types"
import { CATEGORIA_LABELS, STATUS_LABELS, propLabel } from "./labels"
import type { ChecklistRow, CompareKind, CompareNode, CompareResult, CompareSide, CompareStatus, CompareSummary, PropDiff } from "./types"

/** Ids that change whenever a process is copied between portals — never a real difference. */
const IGNORED_KEYS = new Set(["id", "idOrigem", "componentId", "fieldId", "popupId", "paginaId", "etapaId",
  // folded into `destino` (see `etapaDestinoLeaf`)
  "etapaDestino"])
/** Keys compared as child nodes (or redundant with them), not as properties. */
const CHILD_KEYS: Record<CompareKind, Set<string>> = {
  etapa: new Set(["passos", "feedbacks"]),
  passo: new Set(["itens"]),
  item: new Set(["filhos", "camposAgrupados"]),
  feedback: new Set(),
}

// ── Flattening ───────────────────────────────────────────────────────────────

function leafText(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "boolean") return value ? "Sim" : "Não"
  return String(value).replace(/\s+/g, " ").trim()
}

/** A flattened leaf: `text` is what's shown, `key` what's compared (equal to `text` except for
 *  values whose display carries context that legitimately differs between the two processes). */
export interface Leaf {
  text: string
  key: string
}

const leaf = (text: string): Leaf => ({ text, key: text })

/** A "Para outra etapa" target is shown with its full reference (etapa, processo, portal) on both
 *  sides, but compared only by the target etapa's name and whether it's the process's own etapa —
 *  so a correct redirect to each process's own etapa isn't flagged just because the process and
 *  portal names differ, while a copy still pointing at the other process is. */
function etapaDestinoLeaf(d: EtapaDestinoSpec): Leaf {
  const alvo = d.mesmoProcesso ? "próprio processo" : `outro: ${normalizeText(d.processo)} / ${normalizeText(d.portal ?? "")}`
  return { text: describeEtapaDestino(d), key: `${normalizeText(d.etapa)} | ${alvo}` }
}

/** Flattens an object into `path -> leaf`. Arrays of objects become indexed paths
 *  (`regras[0].campo`), arrays of primitives a single comma-joined leaf, empty values are dropped
 *  (so "not configured" and "absent" compare equal). */
export function flatten(value: unknown, skip: Set<string> = new Set(), prefix = "", out: Map<string, Leaf> = new Map()): Map<string, Leaf> {
  if (value === null || value === undefined) return out
  if (Array.isArray(value)) {
    if (value.length === 0) return out
    if (value.every((v) => v === null || typeof v !== "object")) {
      const text = value.map(leafText).filter(Boolean).join(", ")
      if (text) out.set(prefix, leaf(text))
      return out
    }
    value.forEach((v, i) => flatten(v, new Set(), `${prefix}[${i}]`, out))
    return out
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const destino = obj.etapaDestino as EtapaDestinoSpec | undefined
    for (const key of Object.keys(obj).sort()) {
      if (IGNORED_KEYS.has(key) || skip.has(key)) continue
      const path = prefix ? `${prefix}.${key}` : key
      if (key === "destino" && destino) out.set(path, etapaDestinoLeaf(destino))
      else flatten(obj[key], new Set(), path, out)
    }
    return out
  }
  const text = leafText(value)
  if (text) out.set(prefix, leaf(text))
  return out
}

function diffProps(kind: CompareKind, a: object, b: object): { diffs: PropDiff[]; propCount: number } {
  const fa = flatten(a, CHILD_KEYS[kind])
  const fb = flatten(b, CHILD_KEYS[kind])
  const keys = [...new Set([...fa.keys(), ...fb.keys()])]
  const diffs: PropDiff[] = []
  for (const key of keys) {
    const va = fa.get(key)
    const vb = fb.get(key)
    if ((va?.key ?? "") !== (vb?.key ?? "")) diffs.push({ prop: key, label: propLabel(key), a: va?.text ?? "", b: vb?.text ?? "" })
  }
  return { diffs, propCount: keys.length }
}

// ── Matching ─────────────────────────────────────────────────────────────────

const norm = (s: string | undefined) => (s ? normalizeText(s) : "")

/** Matching keys per element, strongest first; an empty string means "no key at this tier". */
function itemKeys(item: ItemSpec): string[] {
  const cat = item.categoria
  const nome = norm(item.nome) || norm(item.detalhes?.basico.rotulo)
  const chave = norm(item.chave)
  return [
    chave && nome ? `${cat}|${chave}|${nome}` : "",
    item.nomeSistema ? `${cat}|sis|${norm(item.nomeSistema)}` : "",
    nome ? `${cat}|nome|${nome}` : "",
    chave ? `${cat}|chave|${chave}` : "",
    nome ? `nome|${nome}` : "",
  ]
}
const namedKeys = (x: { nome: string }) => [norm(x.nome)]

/** Pairs two ordered lists tier by tier: at each tier, every still-unmatched A element takes the
 *  first still-unmatched B element with the same key — so duplicated names pair 1st with 1st.
 *  Returns pairs in A order followed by B-only leftovers in B order. */
export function matchLists<T>(a: T[], b: T[], keysOf: (x: T) => string[]): { ai?: number; bi?: number }[] {
  const ka = a.map(keysOf)
  const kb = b.map(keysOf)
  const tiers = Math.max(0, ...ka.map((k) => k.length), ...kb.map((k) => k.length))
  const aToB = new Map<number, number>()
  const usedB = new Set<number>()
  for (let t = 0; t < tiers; t++) {
    const pool = new Map<string, number[]>()
    kb.forEach((k, j) => {
      if (usedB.has(j) || !k[t]) return
      pool.set(k[t], [...(pool.get(k[t]) ?? []), j])
    })
    ka.forEach((k, i) => {
      if (aToB.has(i) || !k[t]) return
      const queue = pool.get(k[t])
      const j = queue?.shift()
      if (j === undefined) return
      aToB.set(i, j)
      usedB.add(j)
    })
  }
  const pairs: { ai?: number; bi?: number }[] = a.map((_, i) => ({ ai: i, bi: aToB.get(i) }))
  b.forEach((_, j) => {
    if (!usedB.has(j)) pairs.push({ bi: j })
  })
  return pairs
}

/** Indexes (into `pairs`) of matched pairs whose relative order differs between A and B — the
 *  matched elements outside the longest increasing subsequence of B positions. */
function movedPairs(pairs: { ai?: number; bi?: number }[]): Set<number> {
  const matched = pairs.map((p, idx) => ({ ...p, idx })).filter((p) => p.ai !== undefined && p.bi !== undefined)
  const seq = matched.map((p) => p.bi!)
  const n = seq.length
  const len = new Array<number>(n).fill(1)
  const prev = new Array<number>(n).fill(-1)
  let best = -1
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < i; j++)
      if (seq[j] < seq[i] && len[j] + 1 > len[i]) {
        len[i] = len[j] + 1
        prev[i] = j
      }
    if (best < 0 || len[i] > len[best]) best = i
  }
  const keep = new Set<number>()
  for (let i = best; i >= 0; i = prev[i]) keep.add(i)
  return new Set(matched.filter((_, i) => !keep.has(i)).map((p) => p.idx))
}

// ── Tree building ────────────────────────────────────────────────────────────

type Spec = EtapaSpec | PassoSpec | ItemSpec | FeedbackSpec

interface Level<T extends Spec> {
  kind: CompareKind
  tipo: (x: T) => string
  label: (x: T) => string
  keys: (x: T) => string[]
  children: (a: T | undefined, b: T | undefined, path: string[], id: string) => CompareNode[]
}

function itemLabel(item: ItemSpec): string {
  return item.nome?.trim() || item.detalhes?.basico.rotulo?.trim() || item.nomeComponente?.trim() || item.tipo || "(sem nome)"
}

function compareList<T extends Spec>(a: T[], b: T[], level: Level<T>, path: string[], parentId: string): CompareNode[] {
  const pairs = matchLists(a, b, level.keys)
  const moved = movedPairs(pairs)
  return pairs.map((p, idx) => {
    const ea = p.ai !== undefined ? a[p.ai] : undefined
    const eb = p.bi !== undefined ? b[p.bi] : undefined
    const ref = (ea ?? eb)!
    const label = level.label(ref)
    const id = `${parentId}/${level.kind}:${p.ai ?? "-"}:${p.bi ?? "-"}`
    const childPath = [...path, label]
    let status: CompareStatus
    let diffs: PropDiff[] = []
    let propCount = 0
    if (ea && eb) {
      ;({ diffs, propCount } = diffProps(level.kind, ea, eb))
      if (level.label(ea) !== level.label(eb) && !diffs.some((d) => d.prop === "nome"))
        diffs.unshift({ prop: "nome", label: "Nome", a: level.label(ea), b: level.label(eb) })
      if (moved.has(idx)) diffs.push({ prop: "ordem", label: "Ordem", a: `Posição ${p.ai! + 1}`, b: `Posição ${p.bi! + 1}` })
      status = diffs.length ? "diferente" : "igual"
    } else status = ea ? "so_a" : "so_b"

    const children = level.children(ea, eb, childPath, id)
    return {
      id,
      kind: level.kind,
      tipo: level.tipo(ref),
      label,
      path,
      status,
      diffs,
      propCount,
      children,
      hasDifference: status !== "igual" || children.some((c) => c.hasDifference),
      a: ea,
      b: eb,
    }
  })
}

const ITEM_LEVEL: Level<ItemSpec> = {
  kind: "item",
  tipo: (x) => CATEGORIA_LABELS[x.categoria] ?? x.categoria,
  label: itemLabel,
  keys: itemKeys,
  children: (a, b, path, id) => compareList(a?.filhos ?? [], b?.filhos ?? [], ITEM_LEVEL, path, id),
}

const PASSO_LEVEL: Level<PassoSpec> = {
  kind: "passo",
  tipo: () => "Passo",
  label: (x) => x.nome?.trim() || "(sem nome)",
  keys: namedKeys,
  children: (a, b, path, id) => compareList(a?.itens ?? [], b?.itens ?? [], ITEM_LEVEL, path, id),
}

const FEEDBACK_LEVEL: Level<FeedbackSpec> = {
  kind: "feedback",
  tipo: () => "Feedback",
  label: (x) => x.nome?.trim() || "(sem nome)",
  keys: namedKeys,
  children: () => [],
}

const ETAPA_LEVEL: Level<EtapaSpec> = {
  kind: "etapa",
  tipo: () => "Etapa",
  label: (x) => x.nome?.trim() || "(sem nome)",
  keys: namedKeys,
  children: (a, b, path, id) => [
    ...compareList(a?.passos ?? [], b?.passos ?? [], PASSO_LEVEL, path, id),
    ...compareList(a?.feedbacks ?? [], b?.feedbacks ?? [], FEEDBACK_LEVEL, path, id),
  ],
}

export function compareProcesses(a: DocumentacaoPS, b: DocumentacaoPS, sides?: { a?: Partial<CompareSide>; b?: Partial<CompareSide> }): CompareResult {
  const side = (doc: DocumentacaoPS, extra?: Partial<CompareSide>): CompareSide => ({
    portal: extra?.portal ?? (doc.idPortal ? `Portal ${doc.idPortal}` : ""),
    processo: extra?.processo ?? doc.tituloPortal,
    idPs: doc.idPs,
  })
  return { a: side(a, sides?.a), b: side(b, sides?.b), etapas: compareList(a.etapas, b.etapas, ETAPA_LEVEL, [], "ps") }
}

// ── Outputs ──────────────────────────────────────────────────────────────────

export function walk(nodes: CompareNode[], visit: (n: CompareNode) => void) {
  for (const n of nodes) {
    visit(n)
    walk(n.children, visit)
  }
}

const emptyCounts = (): Record<CompareStatus, number> => ({ igual: 0, diferente: 0, so_a: 0, so_b: 0 })

export function summarize(result: CompareResult): CompareSummary {
  const summary: CompareSummary = { ...emptyCounts(), porTipo: {}, total: 0 }
  walk(result.etapas, (n) => {
    summary[n.status] += 1
    summary.total += 1
    const t = (summary.porTipo[n.tipo] ??= emptyCounts())
    t[n.status] += 1
  })
  return summary
}

/** One row per difference (a "só em A/B" element is a single row — its descendants are implied
 *  by it, so they don't get rows of their own; an equal element one row, so the checklist can also
 *  list what's already aligned). */
export function toChecklistRows(result: CompareResult): ChecklistRow[] {
  const rows: ChecklistRow[] = []
  const visit = (nodes: CompareNode[]) => nodes.forEach((n) => {
    const base = { tipo: n.tipo, elemento: n.label, caminho: [...n.path, n.label].join(" › "), status: n.status }
    if (n.status === "so_a" || n.status === "so_b") {
      rows.push({
        ...base,
        id: `${n.id}#elemento`,
        propriedade: `(${n.tipo.toLowerCase()} inteiro)`,
        valorA: n.status === "so_a" ? "Existe" : "Não existe",
        valorB: n.status === "so_b" ? "Existe" : "Não existe",
      })
    } else if (n.status === "igual") {
      rows.push({ ...base, id: `${n.id}#igual`, propriedade: `${n.propCount} propriedade(s)`, valorA: STATUS_LABELS.igual, valorB: STATUS_LABELS.igual })
    } else {
      for (const d of n.diffs) rows.push({ ...base, id: `${n.id}#${d.prop}`, propriedade: d.label, valorA: d.a, valorB: d.b })
    }
    if (n.status !== "so_a" && n.status !== "so_b") visit(n.children)
  })
  visit(result.etapas)
  return rows
}
