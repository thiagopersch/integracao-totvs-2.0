import type { EtapaSpec, FeedbackSpec, ItemSpec, PassoSpec } from "@/lib/ps-docs/types"

export type CompareStatus = "igual" | "diferente" | "so_a" | "so_b"
export type CompareKind = "etapa" | "passo" | "item" | "feedback"

/** One property that differs between the two sides of a matched pair. Values are already
 *  normalized to display text ("" = not configured). */
export interface PropDiff {
  prop: string
  label: string
  a: string
  b: string
}

export interface CompareNode {
  id: string
  kind: CompareKind
  /** "Etapa", "Passo", "Campo", "Botão"... */
  tipo: string
  label: string
  /** Labels of the ancestors, root first (excluding this node). */
  path: string[]
  status: CompareStatus
  diffs: PropDiff[]
  /** Number of properties compared on this node (equal + different). */
  propCount: number
  children: CompareNode[]
  /** True when this node or any descendant isn't "igual". */
  hasDifference: boolean
  a?: EtapaSpec | PassoSpec | ItemSpec | FeedbackSpec
  b?: EtapaSpec | PassoSpec | ItemSpec | FeedbackSpec
}

export interface CompareSide {
  portal: string
  processo: string
  idPs: string
}

export interface CompareResult {
  a: CompareSide
  b: CompareSide
  etapas: CompareNode[]
}

export interface ChecklistRow {
  id: string
  caminho: string
  tipo: string
  elemento: string
  propriedade: string
  valorA: string
  valorB: string
  status: CompareStatus
}

export type CompareSummary = Record<CompareStatus, number> & {
  porTipo: Record<string, Record<CompareStatus, number>>
  total: number
}
