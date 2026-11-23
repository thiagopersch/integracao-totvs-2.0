import { describe, expect, it } from "vitest"
import type { DocumentacaoPS, EtapaSpec, ItemSpec, PassoSpec } from "@/lib/ps-docs/types"
import { compareProcesses, flatten, matchLists, summarize, toChecklistRows, walk } from "./compare"
import type { CompareNode } from "./types"

const campo = (nome: string, extra: Partial<ItemSpec> = {}): ItemSpec => ({ categoria: "campo", nome, tipo: "textfield", obrigatorio: false, ...extra })
const passo = (nome: string, itens: ItemSpec[]): PassoSpec => ({ nome, itens, consultaSql: { configurada: false } })
const etapa = (nome: string, passos: PassoSpec[], extra: Partial<EtapaSpec> = {}): EtapaSpec => ({
  nome,
  ativa: true,
  logicaExibicao: { regras: [] },
  descricao: "",
  consultaSql: { configurada: false },
  passos,
  feedbacks: [],
  ...extra,
})
const doc = (etapas: EtapaSpec[], idPs = "1"): DocumentacaoPS => ({ tituloPortal: `PS ${idPs}`, idPs, etapas })

function find(nodes: CompareNode[], label: string): CompareNode | undefined {
  let found: CompareNode | undefined
  walk(nodes, (n) => {
    if (!found && n.label === label) found = n
  })
  return found
}

const base = () =>
  doc([
    etapa("Dados pessoais", [passo("Identificação", [campo("Nome", { nomeSistema: "Nome" }), campo("CPF", { nomeSistema: "CPF", obrigatorio: true })])]),
    etapa("Pagamento", [passo("Boleto", [{ categoria: "botao", nome: "Pagar", tipo: "button" }])]),
  ])

describe("compareProcesses", () => {
  it("reports everything equal when a process is compared with itself, ignoring ids", () => {
    const a = base()
    const b = base()
    b.etapas[0].id = 999
    b.etapas[0].passos[0].itens[0].fieldId = 42
    const summary = summarize(compareProcesses(a, b))
    expect(summary.diferente + summary.so_a + summary.so_b).toBe(0)
    expect(summary.igual).toBe(summary.total)
  })

  it("detects a changed property with a friendly label", () => {
    const b = base()
    b.etapas[0].passos[0].itens[1].obrigatorio = false
    b.etapas[0].consultaSql = { configurada: true, codColigada: "1", codSistema: "S", codConsulta: "RB.01", usaCache: false, parametros: [] }
    const res = compareProcesses(base(), b)
    const cpf = find(res.etapas, "CPF")!
    expect(cpf.status).toBe("diferente")
    expect(cpf.diffs).toEqual([{ prop: "obrigatorio", label: "Obrigatório", a: "Sim", b: "Não" }])
    const et = find(res.etapas, "Dados pessoais")!
    expect(et.diffs.map((d) => d.label)).toContain("Consulta SQL › Código da consulta")
    expect(et.hasDifference).toBe(true)
  })

  it("matches a renamed campo through its system field and reports the rename", () => {
    const b = base()
    b.etapas[0].passos[0].itens[0].nome = "Nome completo"
    const node = find(compareProcesses(base(), b).etapas, "Nome")!
    expect(node.status).toBe("diferente")
    expect(node.diffs[0]).toMatchObject({ prop: "nome", a: "Nome", b: "Nome completo" })
  })

  it("lists elements that exist on only one side, without rows for their descendants", () => {
    const b = base()
    b.etapas[0].passos[0].itens.splice(1, 1) // remove CPF
    b.etapas.push(etapa("Documentos", [passo("Upload", [campo("RG")])]))
    const res = compareProcesses(base(), b)
    expect(find(res.etapas, "CPF")!.status).toBe("so_a")
    expect(find(res.etapas, "Documentos")!.status).toBe("so_b")
    const rows = toChecklistRows(res)
    expect(rows.find((r) => r.elemento === "Documentos")?.status).toBe("so_b")
    expect(rows.some((r) => r.elemento === "RG")).toBe(false)
  })

  it("pairs duplicated names first-with-first", () => {
    expect(matchLists(["x", "y", "x"], ["x", "x"], (s) => [s])).toEqual([{ ai: 0, bi: 0 }, { ai: 1 }, { ai: 2, bi: 1 }])
  })

  it("compares agrupamento children recursively", () => {
    const grupo = (filhos: ItemSpec[]): ItemSpec => ({ categoria: "agrupamento", nome: "Endereço", tipo: "container", filhos })
    const a = doc([etapa("E", [passo("P", [grupo([campo("Rua"), campo("Número")])])])])
    const b = doc([etapa("E", [passo("P", [grupo([campo("Rua", { obrigatorio: true })])])])])
    const res = compareProcesses(a, b)
    expect(find(res.etapas, "Endereço")!.status).toBe("igual")
    expect(find(res.etapas, "Endereço")!.hasDifference).toBe(true)
    expect(find(res.etapas, "Rua")!.status).toBe("diferente")
    expect(find(res.etapas, "Número")!.status).toBe("so_a")
  })

  it("flags reordered elements", () => {
    const b = base()
    b.etapas.reverse()
    const res = compareProcesses(base(), b)
    const moved = res.etapas.filter((n) => n.diffs.some((d) => d.prop === "ordem"))
    expect(moved).toHaveLength(1)
  })
})

describe("flatten", () => {
  it("indexes object arrays, joins primitive arrays and drops empty values", () => {
    const flat = flatten({ regras: [{ campo: "A", regra: "=" }], vinculos: ["x", "y"], vazio: "", lista: [], ok: true })
    expect([...flat]).toEqual([
      ["ok", "Sim"],
      ["regras[0].campo", "A"],
      ["regras[0].regra", "="],
      ["vinculos", "x, y"],
    ])
  })
})
