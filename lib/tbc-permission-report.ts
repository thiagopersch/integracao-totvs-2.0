/** One profile section of an RM "Relatório de permissões dos perfis" (text already extracted from the PDF). */
export type ParsedReportProfile = {
  /** System name from the title, e.g. "CLASSIS NET", "FLUXUS". */
  systemName: string
  /** RM system code inferred from `systemName`; null when the system isn't known. */
  codSistema: string | null
  codPerfil: string
  nomePerfil: string
  /** Menu access code → label, as printed ("02.01.01.01" → "Incluir Processo Seletivo"). */
  accesses: Record<string, string>
}

const SYSTEM_CODES: Record<string, string> = {
  "CLASSIS NET": "S",
  "CLASSIS .NET": "S",
  FLUXUS: "F",
  TESTIS: "B",
}

const TITLE = /Relat[óo]rio de permiss[õo]es dos perfis do RM\s+([^\n]+)/i
const HEADER = /Perfil:\s*(\S+)\s+Nome do Perfil:\s*([^\n]+)/g
const ACCESS = /\[(\d{2}(?:\.\d{2})*)\]\s*([^\n[]*)/g

/**
 * Splits the report text into one entry per "Perfil:" header (a report can hold several profiles)
 * and collects every `[code] label` under each. The report only prints menu items the profile can
 * access, so a code's presence is the permission. Returns [] when the text isn't such a report.
 */
export function parsePermissionReport(text: string): ParsedReportProfile[] {
  const systemName = (TITLE.exec(text)?.[1] ?? "").trim().toUpperCase()
  const codSistema = SYSTEM_CODES[systemName] ?? null
  const headers = [...text.matchAll(HEADER)]

  return headers.map((header, i) => {
    const start = header.index! + header[0].length
    const end = i + 1 < headers.length ? headers[i + 1].index! : text.length
    const accesses: Record<string, string> = {}
    for (const [, code, label] of text.slice(start, end).matchAll(ACCESS)) {
      accesses[code] = label.trim()
    }
    return { systemName, codSistema, codPerfil: header[1].trim(), nomePerfil: header[2].trim(), accesses }
  })
}
