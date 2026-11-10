import { describe, expect, it } from "vitest"
import { mapForwardData, EMPTY_CATALOGS, describeLogica } from "@/lib/ps-docs/parse-structure"
import { resolveStageRedirects } from "./stage-redirects"
import type { RubeusClient, RubeusResponse } from "./rubeus-client"

const API = "https://admin.portal.apprbs.com.br/api"

function fakeClient(routes: Record<string, RubeusResponse>): RubeusClient {
  const res = (url: string) => Promise.resolve(routes[url] ?? { status: 404, data: null })
  return { get: res, post: res, requestCount: 0 }
}

const routes: Record<string, RubeusResponse> = {
  [`${API}/selective-process/button-redirect-stage/289768`]: { status: 200, data: { portal_id: 5475, selective_process_id: 22587, stage_id: 289768 } },
  [`${API}/selective-process/opening-page-stages/22587`]: { status: 200, data: [{ id: 289767, title: "Cadastro" }, { id: 289768, title: "Inscrição" }] },
  [`${API}/portal/selective-process-local/5475`]: { status: 200, data: [{ id: 22587, name: "Vestibular 2027" }] },
  [`${API}/portal`]: { status: 200, data: [{ id: 5475, name: "Portal Graduação" }] },
}

const encs = () =>
  mapForwardData({ forwardData: [{ redirect_type_id: 3, stage_id: 289768, position: 0, parameters: [], logics: [] }] }, new Map(), EMPTY_CATALOGS)

describe("resolveStageRedirects", () => {
  it("names an etapa of the same process", async () => {
    const list = encs()
    expect(list[0].destino).toBe("Outra etapa (etapa #289768)")
    const warnings: string[] = []
    await resolveStageRedirects(fakeClient(routes), [{ itens: [{ encaminhamentos: list }] }], { idPs: "22587" }, warnings)
    expect(list[0].destino).toBe("Etapa: Inscrição")
    expect(warnings).toEqual([])
  })

  it("adds the process and portal for an etapa of another process", async () => {
    const list = encs()
    await resolveStageRedirects(fakeClient(routes), [list], { idPs: "1" }, [])
    expect(list[0].destino).toBe("Etapa: Inscrição (processo seletivo Vestibular 2027, portal Portal Graduação)")
  })

  it("keeps the #id fallback and warns when the lookup fails", async () => {
    const list = encs()
    const warnings: string[] = []
    await resolveStageRedirects(fakeClient({}), [list], { idPs: "22587" }, warnings)
    expect(list[0].destino).toBe("Outra etapa (etapa #289768)")
    expect(warnings).toHaveLength(1)
  })
})

describe("checkbox values in logic rules", () => {
  it("shows Selecionado / Não selecionado for boolean values", () => {
    const logica = describeLogica(
      {
        action_logic_id: 1,
        logics: [
          { field_compare_id: 1, rule_logic_id: 1, fixed_value: true },
          { field_compare_id: 2, rule_logic_id: 1, fixed_value: "false" },
          { field_compare_id: 3, rule_logic_id: 1, fixed_value: "Sim" },
        ],
      },
      new Map(),
      "elemento"
    )
    expect(logica?.regras.map((r) => r.valor)).toEqual(["Selecionado", "Não selecionado", "Sim"])
  })
})
