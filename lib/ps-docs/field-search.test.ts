import { describe, expect, it } from "vitest"
import { buildQuery, collectContainerReferences, searchProcessDoc, searchStandaloneContainer } from "./field-search"
import type { DocumentacaoPS, ItemSpec, PopupSpec } from "./types"

const campo = (nome: string, fieldId: number, extra: Partial<ItemSpec> = {}): ItemSpec => ({ categoria: "campo", nome, tipo: "textfield", fieldId, ...extra })

const popup: PopupSpec = {
  nome: "Confirmação",
  permiteFechar: true,
  itens: [campo("Nome Completo", 10)],
  consultaSql: { configurada: false },
}

const doc: DocumentacaoPS = {
  tituloPortal: "PS Teste",
  idPs: "1",
  etapas: [
    {
      nome: "Dados de inscrição",
      ativa: true,
      logicaExibicao: { regras: [] },
      descricao: "",
      consultaSql: { configurada: false },
      passos: [
        { nome: "Passo 1", itens: [campo("Nome completo", 10)], consultaSql: { configurada: false } },
        {
          nome: "Passo 2",
          consultaSql: { configurada: true, codColigada: "0", codSistema: "S", codConsulta: "RB.01", usaCache: false, parametros: [{ nome: "NOME", tipo: "Campo do sistema", campoSistema: "Nome completo (10)" }] },
          itens: [
            campo("Nome completo", 10, { classeCss: "col-6 ps-input-hidden" }),
            {
              categoria: "agrupamento",
              nome: "Bloco oculto",
              tipo: "container",
              classeCss: "fields-hidden",
              filhos: [campo("Nome completo", 10)],
            },
            campo("CPF", 20, { logica: { acao: "Mostrar", regras: [{ campo: "Nome completo (10)", regra: "preenchido" }] } }),
            {
              categoria: "botao",
              nome: "Avançar",
              tipo: "button",
              encaminhamentos: [{ tipo: "Abrir pop-up", destino: "Confirmação", novaAba: false, popupId: 99, popupDetalhe: popup }],
            },
          ],
        },
      ],
      feedbacks: [{ nome: "Aprovado", condicao: "Nome completo (10) preenchido", conclusivo: true }],
    },
  ],
}

const source = { portal: "—", processo: "1 | PS Teste", doc }

describe("searchProcessDoc", () => {
  const hits = searchProcessDoc(source, buildQuery("nome COMPLETO"))
  const componentes = hits.filter((h) => h.tipoUso === "Componente")

  it("finds the field in every passo, agrupamento and pop-up, accent/case-insensitive", () => {
    expect(componentes.map((h) => [h.passo, h.caminho, h.popup])).toEqual([
      ["Passo 1", undefined, undefined],
      ["Passo 2", undefined, undefined],
      ["Passo 2", "Bloco oculto", undefined],
      ["Passo 2", undefined, "Confirmação"],
    ])
  })

  it("flags hidden fields by own class and by an ancestor agrupamento's class", () => {
    expect(componentes.map((h) => h.oculto)).toEqual(["Não", "Sim", "Sim", "Não"])
    expect(componentes[1].motivoOculto).toBe("classe ps-input-hidden")
    expect(componentes[2].motivoOculto).toContain('agrupamento "Bloco oculto"')
  })

  it("lists references in logic, SQL parameters and feedback conditions", () => {
    const refs = hits.filter((h) => h.tipoUso !== "Componente").map((h) => [h.tipoUso, h.componente])
    expect(refs).toEqual(
      expect.arrayContaining([
        ["Lógica de exibição", "CPF"],
        ["Consulta SQL", 'Passo "Passo 2"'],
        ["Condição de feedback", "Aprovado"],
      ])
    )
  })

  it("matches by field id when the term is numeric", () => {
    expect(searchProcessDoc(source, buildQuery("10")).filter((h) => h.tipoUso === "Componente")).toHaveLength(4)
  })

  it("exact mode does not match partial names", () => {
    expect(searchProcessDoc(source, buildQuery("nome", true))).toHaveLength(0)
  })
})

describe("standalone containers and references", () => {
  it("searches a standalone page", () => {
    const hits = searchStandaloneContainer({ kind: "page", spec: { nome: "Minha página", itens: [campo("Nome completo", 10)] } }, "Portal 1", buildQuery("nome completo"))
    expect(hits).toHaveLength(1)
    expect(hits[0].pagina).toBe("Minha página")
  })

  it("collects referenced pop-up ids", () => {
    expect([...collectContainerReferences(doc).popupIds]).toEqual([99])
  })
})

describe("action search", () => {
  const botao: ItemSpec = {
    categoria: "botao",
    nome: "Concluir",
    nomeComponente: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas",
    tipo: "button",
    componentId: 4127860,
    acoesPrimeiroPlano: [
      {
        ordem: 2,
        plano: "primeiro",
        grupo: "Ações TOTVS",
        tipoAcao: "Executar processo",
        titulo: "[FV#155]: Atualizar escolar anterior MetaDados",
        descricao: "Executar processo no TOTVS",
        dataserver: "Fórmula visual",
        colunas: [
          { coluna: "IDFV", correspondente: "Valor fixo: 155" },
          { coluna: "PARAMETER5", correspondente: "Nome completo (190988)" },
        ],
        camposConfigurados: [],
        parametros: [{ nome: "$CODCOLIGADA", tipo: "Campo do sistema", campoSistema: "CODCOLIGADA (191054)" }],
        ativada: true,
      },
    ],
  }
  const actionDoc: DocumentacaoPS = {
    tituloPortal: "PS",
    idPs: "2",
    etapas: [{ nome: "E1", ativa: true, logicaExibicao: { regras: [] }, descricao: "", consultaSql: { configurada: false }, feedbacks: [], passos: [{ nome: "P1", itens: [botao], consultaSql: { configurada: false } }] }],
  }
  const run = (term: string) => searchProcessDoc({ portal: "—", processo: "2 | PS", doc: actionDoc }, buildQuery(term))

  it("finds the action by a configured column and carries component/action ids", () => {
    const hits = run("idfv")
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatchObject({ tipoUso: "Ação do botão", componentId: 4127860, acaoOrdem: 2, nomeComponente: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas" })
    expect(hits[0].detalheUso).toContain("coluna IDFV = Valor fixo: 155")
    expect(hits[0]).toMatchObject({ acao: "[FV#155]: Atualizar escolar anterior MetaDados", coluna: "IDFV", valor: "155" })
  })

  it("finds the action by its name and by a fixed value", () => {
    expect(run("FV#155")[0].detalheUso).toContain("nome da ação")
    expect(run("155").some((h) => h.detalheUso?.includes("IDFV"))).toBe(true)
  })

  it("finds the button by its internal component name", () => {
    expect(run("santa cruz")).toEqual([expect.objectContaining({ tipoUso: "Componente", componentId: 4127860, nomeComponente: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas" })])
  })

  it("finds parameters by name", () => {
    expect(run("$codcoligada")[0].detalheUso).toContain('parâmetro "$CODCOLIGADA"')
  })
})
