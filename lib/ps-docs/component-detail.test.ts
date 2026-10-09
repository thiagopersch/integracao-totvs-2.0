import { describe, expect, it } from "vitest"
import { parseComponentDetail } from "./component-detail"
import { EMPTY_CATALOGS } from "./parse-structure"

// Trimmed from a real `GET /api/custom-component/4127860` response.
const raw = {
  id: 4127860,
  name: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas",
  label: "Concluir",
  type: "button",
  store_data: 1,
  forward_user: 1,
  close_popup: 0,
  name_edited_by: "Tiago Persch",
  logics: [],
  totvs_query: {
    title: "Realizar Consulta",
    code: "RB.PS.IM.COL.069",
    colligate: "0",
    system: "S",
    parameters: [{ name: "ESCOLA1", parameter_type_id: 1, field_id: 316177, fixed_param: 0, fixed_value: null }],
    context: [],
  },
  button_actions: [
    {
      id: 4432104,
      position: 2,
      status: 1,
      description: "<b>[FV#155]: Atualizar escolar anterior MetaDados</b>",
      error_message: "Erro 155: Não foi possível atualizar os dados",
      execution_group: 1,
      button_actions_type_id: 1,
      button_actions_type: { title: "Ações TOTVS" },
      actions: [
        {
          id: 889487,
          title: "Executar processo",
          repeat: 0,
          totvs_process_type_id: 10,
          parameters: [{ name: "$CODCOLIGADA", fixed_param: 0, field_id: 191054 }],
          fields: [
            { field_id: null, type: 2, fixed_value: "155", title: null, totvs_column: "IDFV" },
            { field_id: 190988, type: 1, fixed_value: null, title: "Nome completo", totvs_column: "PARAMETER5" },
          ],
          logics: [],
          action_type_id: 3,
          discription: "Executar processo no TOTVS",
        },
      ],
    },
    {
      id: 4432102,
      position: 0,
      status: 0,
      description: "<b>Salvar dados de escola anterior na inscrição</b>",
      execution_group: 1,
      button_actions_type_id: 1,
      button_actions_type: { title: "Ações TOTVS" },
      actions: [
        {
          id: 1301589,
          title: "Salvar Dados",
          totvs_data_server_type_id: 1,
          parameters: [],
          fields: [{ field_id: 208381, type: 1, fixed_value: null, title: "Escolas (TOTVS)", totvs_table: "SPSInscAreaOfertaCompl", totvs_column: "ULTIMAESCOLAANTERIOR" }],
          logics: [],
          action_type_id: 2,
        },
      ],
    },
  ],
  forwardData: [{ redirect_type_id: 4, position: 0, use_parameters: 0, new_tab: 0, parameters: [], logics: [] }],
}

describe("parseComponentDetail", () => {
  const catalog = new Map<number, string>([
    [190988, "Nome completo"],
    [191054, "CODCOLIGADA"],
  ])
  const detail = parseComponentDetail(raw, catalog, EMPTY_CATALOGS)

  it("reads the header, flags and the component's own query", () => {
    expect(detail).toMatchObject({ id: 4127860, nome: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas", rotulo: "Concluir", editadoPor: "Tiago Persch" })
    expect(detail.flags.filter((f) => f.ativo).map((f) => f.label)).toEqual(["Salva dados", "Redireciona usuário"])
    expect(detail.consulta).toMatchObject({ codigo: "RB.PS.IM.COL.069", coligada: "0", sistema: "S" })
    expect(detail.consulta?.parametros[0]).toEqual({ nome: "ESCOLA1", tipo: "Campo do sistema", campoSistema: "campo #316177" })
  })

  it("orders button_actions by position and keeps every field and parameter", () => {
    expect(detail.grupos.map((g) => [g.ordem, g.titulo, g.ativa])).toEqual([
      [0, "Salvar dados de escola anterior na inscrição", false],
      [2, "[FV#155]: Atualizar escolar anterior MetaDados", true],
    ])
    const processo = detail.grupos[1].acoes[0]
    expect(processo).toMatchObject({ tipoAcao: "Executar processo", descricao: "Executar processo no TOTVS", destino: "Processo (#10)" })
    expect(processo.campos).toEqual([
      expect.objectContaining({ coluna: "IDFV", valorFixo: "155" }),
      expect.objectContaining({ coluna: "PARAMETER5", campo: "Nome completo (190988)" }),
    ])
    expect(processo.parametros).toEqual([{ nome: "$CODCOLIGADA", tipo: "Campo do sistema", campoSistema: "CODCOLIGADA (191054)" }])
    expect(detail.grupos[0].acoes[0].campos[0]).toMatchObject({ tabela: "SPSInscAreaOfertaCompl", coluna: "ULTIMAESCOLAANTERIOR" })
  })

  it("maps forwardData", () => {
    expect(detail.encaminhamentos).toEqual([expect.objectContaining({ tipo: expect.any(String), destino: "Portal" })])
  })
})
