import { describe, expect, it } from "vitest"
import { parsePermissionReport, type ParsedReportProfile } from "./tbc-permission-report"
import { compareCodes, diffProfile, matchReportProfiles } from "./tbc-permission-compare"
import type { ReferenceProfile } from "@/config/tbc-permission-models/types"

// Text as unpdf extracts it from an RM report (note the glued "Fornecedores" line).
const REPORT = `Relatório de permissões dos perfis do RM FLUXUS
Perfil: fin-cliente Nome do Perfil: Financeiro Cliente
Menus com permissão de acesso
[01] Cadastros
[01.01] Específicos
[01.01.01] Clientes
Fornecedores [01.01.01.01] Inserir novo Cliente/Fornecedor
[02] Contas a Pagar / Receber
Acesso à Tabelas e Campos Pode Consultar Pode Alterar`

const reference = (key: string, codSistema: string, codes: string[]): ReferenceProfile => ({
  key,
  label: key,
  codSistema,
  suggestedCodPerfil: key,
  source: "test.pdf",
  accesses: codes.map((code) => ({ code, label: `menu ${code}` })),
})

const uploaded = (codPerfil: string, codSistema: string | null, codes: string[]): ParsedReportProfile => ({
  systemName: "",
  codSistema,
  codPerfil,
  nomePerfil: codPerfil,
  accesses: Object.fromEntries(codes.map((c) => [c, `menu ${c}`])),
})

describe("parsePermissionReport", () => {
  it("reads system, profile and every [code] label", () => {
    const [p] = parsePermissionReport(REPORT)
    expect(p.codSistema).toBe("F")
    expect(p.codPerfil).toBe("fin-cliente")
    expect(p.nomePerfil).toBe("Financeiro Cliente")
    expect(Object.keys(p.accesses)).toEqual(["01", "01.01", "01.01.01", "01.01.01.01", "02"])
    expect(p.accesses["01.01.01.01"]).toBe("Inserir novo Cliente/Fornecedor")
  })

  it("splits a report with several profiles", () => {
    const two = `${REPORT}\nPerfil: outro Nome do Perfil: Outro\n[03] Movimentações`
    const profiles = parsePermissionReport(two)
    expect(profiles.map((p) => p.codPerfil)).toEqual(["fin-cliente", "outro"])
    expect(Object.keys(profiles[1].accesses)).toEqual(["03"])
  })

  it("returns nothing for unrelated text", () => {
    expect(parsePermissionReport("qualquer coisa [01] x")).toEqual([])
  })
})

describe("diffProfile", () => {
  it("flags missing and extra codes and computes coverage", () => {
    const diff = diffProfile(reference("fin", "F", ["01", "01.01", "02"]), uploaded("x", "F", ["01", "02", "03"]))
    expect(diff.rows.map((r) => [r.code, r.status])).toEqual([
      ["01", "ok"],
      ["01.01", "missing"],
      ["02", "ok"],
      ["03", "extra"],
    ])
    expect([diff.ok, diff.missing, diff.extra]).toEqual([2, 1, 1])
    expect(diff.coverage).toBeCloseTo(2 / 3)
  })
})

describe("matchReportProfiles", () => {
  it("matches by system and best coverage, each upload used once", () => {
    const refs = [reference("ps", "S", ["01", "02"]), reference("edu", "S", ["05", "06"]), reference("fin", "F", ["01"])]
    const ups = [uploaded("edu-x", "S", ["05", "06"]), uploaded("ps-x", "S", ["01", "02"]), uploaded("fin-x", "F", ["01"])]
    expect(matchReportProfiles(refs, ups)).toEqual({ edu: 0, ps: 1, fin: 2 })
  })

  it("leaves a reference unmatched when nothing covers it", () => {
    expect(matchReportProfiles([reference("ps", "S", ["01"])], [uploaded("y", "S", ["09"])])).toEqual({})
  })
})

describe("compareCodes", () => {
  it("orders numerically by segment", () => {
    expect(["01.02.10", "01.02.09", "01", "01.02"].sort(compareCodes)).toEqual(["01", "01.02", "01.02.09", "01.02.10"])
  })
})
