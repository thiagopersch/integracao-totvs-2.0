import type { ChecklistContext } from "@/actions/integrations/tbc-checklist"

/** Data Server that lists the processos seletivos (sidebar default). */
export const PROCESSO_SELETIVO_DATASERVER = "EduPSProcessoSeletivoData"

/** Data Server auto-added next to the processo seletivo — its áreas ofertadas, by coligada + IDPS. */
export const AREA_OFERTADA_DATASERVER = "EduPSAreaOfertadaData"

/** Module prefixes of the Data Servers that can relate to a processo seletivo (educacional,
 *  financeiro, RH — e.g. EduPS*, FinCFO*, RhuPessoa*). */
const RELATED_DATASERVER_PREFIXES = ["edu", "fin", "rhu"]

export function isRelatedDataserver(code: string): boolean {
  const lower = code.toLowerCase()
  return RELATED_DATASERVER_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

/** Coligada/filial/tipo de curso as typed in the form — kept as strings so they can start empty. */
export type ChecklistContextForm = {
  coligate: string
  branch: string
  levelEducation: string
}

export const EMPTY_CONTEXT_FORM: ChecklistContextForm = { coligate: "", branch: "", levelEducation: "" }

/** The SOAP Contexto once all three fields are filled; `null` while any of them is still empty. */
export function toChecklistContext(form: ChecklistContextForm): ChecklistContext | null {
  const values = [form.coligate, form.branch, form.levelEducation].map((v) => v.trim())
  if (values.some((v) => v === "" || !Number.isFinite(Number(v)))) return null
  const [coligate, branch, levelEducation] = values.map(Number)
  return { coligate, branch, levelEducation }
}
