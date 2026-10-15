import type { ReferenceProfile } from "@/config/tbc-permission-models/types"
import type { ParsedReportProfile } from "@/lib/tbc-permission-report"

export type AccessDiffStatus = "ok" | "missing" | "extra"

export type AccessDiffRow = { code: string; label: string; status: AccessDiffStatus }

export type ProfileDiff = {
  rows: AccessDiffRow[]
  ok: number
  missing: number
  extra: number
  /** Share of the reference accesses the actual profile grants, 0–1. */
  coverage: number
}

/** Code-by-code comparison of the reference profile against the client's actual one. */
export function diffProfile(reference: ReferenceProfile, actual: ParsedReportProfile): ProfileDiff {
  const expected = new Set(reference.accesses.map((a) => a.code))
  const rows: AccessDiffRow[] = reference.accesses.map((a) => ({
    code: a.code,
    label: a.label,
    status: a.code in actual.accesses ? "ok" : "missing",
  }))
  for (const [code, label] of Object.entries(actual.accesses)) {
    if (!expected.has(code)) rows.push({ code, label, status: "extra" })
  }
  rows.sort((a, b) => compareCodes(a.code, b.code))

  const ok = rows.filter((r) => r.status === "ok").length
  const missing = rows.filter((r) => r.status === "missing").length
  return { rows, ok, missing, extra: rows.length - ok - missing, coverage: expected.size ? ok / expected.size : 0 }
}

/** Picks, for each reference profile, the uploaded profile of the same system that covers it best
 *  (the client's profile codes vary, so the name alone can't be trusted). Each uploaded profile is
 *  assigned once — highest coverage first. */
export function matchReportProfiles(
  references: ReferenceProfile[],
  uploaded: ParsedReportProfile[]
): Record<string, number | undefined> {
  const candidates = references.flatMap((ref) =>
    uploaded.flatMap((up, index) =>
      up.codSistema === null || up.codSistema === ref.codSistema
        ? [{ ref: ref.key, index, coverage: diffProfile(ref, up).coverage }]
        : []
    )
  )
  candidates.sort((a, b) => b.coverage - a.coverage)

  const result: Record<string, number | undefined> = {}
  const used = new Set<number>()
  for (const c of candidates) {
    if (c.coverage === 0 || c.ref in result || used.has(c.index)) continue
    result[c.ref] = c.index
    used.add(c.index)
  }
  return result
}

/** Orders "01.02.10" after "01.02.09" — segment by segment, numerically. */
export function compareCodes(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? -1) - (pb[i] ?? -1)
    if (d) return d
  }
  return 0
}
