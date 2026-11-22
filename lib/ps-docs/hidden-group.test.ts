import { describe, expect, it } from "vitest"
import { detectHiddenGroup, hiddenGroupReason } from "./hidden-group"
import { buildRb33Doc, isGrupoOculto, type Rb33Item } from "./rb33-format"
import { renderRb33Fragment } from "./render-rb33-html"
import { rb33ToMarkdown } from "./export-rb33-markdown"
import { renderDocumentHtml } from "./render-html"
import { documentToMarkdown } from "./export-markdown"
import { DEFAULT_DOC_OPTIONS, DEFAULT_STYLE, type DocumentacaoPS, type ItemSpec } from "./types"
import { sampleDetalhes, sampleDoc } from "./__fixtures__/sample-doc"

const campo = (nome: string, esconder: boolean): ItemSpec => ({
  categoria: "campo",
  nome,
  tipo: "text",
  detalhes: { ...sampleDetalhes, basico: { ...sampleDetalhes.basico, esconder } },
})
const grupo = (patch: Partial<ItemSpec>, filhos: ItemSpec[] = [campo("Visível", false)]): ItemSpec => ({ categoria: "agrupamento", nome: "Dados", tipo: "container", filhos, ...patch })

describe("detectHiddenGroup", () => {
  it("name contains 'oculto' (accents/case ignored)", () => {
    expect(detectHiddenGroup(grupo({ nome: "Campos OCULTOS (Agrupamento)" }))).toBe("nome contém “oculto”")
  })

  it("hidden in the builder: flag, class or CSS", () => {
    expect(detectHiddenGroup(grupo({}), true)).toBe("agrupamento escondido no construtor")
    expect(detectHiddenGroup(grupo({ classeCss: "row d-none" }))).toBe("agrupamento escondido no construtor")
    expect(detectHiddenGroup(grupo({ cssCodigo: ".x { display : none; }" }))).toBe("agrupamento escondido no construtor")
  })

  it("every child campo hidden — nested groups included, empty groups never", () => {
    expect(detectHiddenGroup(grupo({}, [campo("A", true), grupo({ nome: "Sub" }, [campo("B", true)])]))).toBe("todos os campos com “Esconder” ativo")
    expect(detectHiddenGroup(grupo({}, [campo("A", true), campo("B", false)]))).toBeUndefined()
    expect(detectHiddenGroup(grupo({}, []))).toBeUndefined()
  })

  it("a normal group and non-groups are not hidden", () => {
    expect(detectHiddenGroup(grupo({}))).toBeUndefined()
    expect(detectHiddenGroup(campo("Oculto", true))).toBeUndefined()
  })

  it("prefers the flag stored at parse time", () => {
    expect(hiddenGroupReason(grupo({ nome: "Campos ocultos", agrupamentoOculto: false }))).toBeUndefined()
    expect(hiddenGroupReason(grupo({ agrupamentoOculto: true, motivoOculto: "x" }))).toBe("x")
  })
})

describe("hidden groups in the documentation", () => {
  const hidden = grupo({ nome: "Campos ocultos", agrupamentoOculto: true, motivoOculto: "nome contém “oculto”" }, [campo("IDPS (316191)", true), campo("RA", true)])
  const doc: DocumentacaoPS = {
    ...sampleDoc,
    etapas: [{ ...sampleDoc.etapas[0], passos: [{ nome: "Dados", consultaSql: { configurada: false }, itens: [campo("Nome", false), hidden, grupo({ nome: "Endereço" }, [campo("Rua", false)])] }] }],
  }

  it("RB-33: one highlighted block with the children tagged Oculto; normal groups still flatten", () => {
    const itens = buildRb33Doc(doc, DEFAULT_DOC_OPTIONS).etapas[0].passos[0].itens
    expect(itens.map((e) => (isGrupoOculto(e) ? `[${e.nome}]` : e.nome))).toEqual(["Nome", "[Campos ocultos]", "Rua"])
    const block = itens[1]
    if (!isGrupoOculto(block)) throw new Error("expected a hidden block")
    expect(block.itens.map((i: Rb33Item) => [i.nome, i.tag])).toEqual([["IDPS", "Oculto"], ["RA", "Oculto"]])
    expect(block.itens.flatMap((i: Rb33Item) => i.notas.map((n) => n.texto))).not.toContain("Campo oculto na tela.")
    expect(buildRb33Doc({ ...doc, etapas: [{ ...doc.etapas[0], passos: [{ ...doc.etapas[0].passos[0], itens: [{ ...hidden, nome: "Controle" }] }] }] }, DEFAULT_DOC_OPTIONS).etapas[0].passos[0].itens[0]).toMatchObject({ titulo: "Agrupamento: Controle — campos ocultos (não exibidos ao candidato)" })
  })

  it("RB-33 HTML and Markdown show the block", () => {
    expect(renderRb33Fragment(doc, DEFAULT_STYLE, DEFAULT_DOC_OPTIONS)).toContain("Agrupamento: Campos ocultos (não exibidos ao candidato)")
    expect(rb33ToMarkdown(doc, DEFAULT_DOC_OPTIONS)).toContain("> **Agrupamento: Campos ocultos (não exibidos ao candidato)**")
  })

  it("Detalhado marks only the hidden group", () => {
    const detalhado = { ...DEFAULT_DOC_OPTIONS, modelo: "detalhado" as const }
    const html = renderDocumentHtml(doc, DEFAULT_STYLE, detalhado)
    expect(html.match(/— campos ocultos/g)).toHaveLength(1)
    expect(html).toContain("Agrupamento de campos ocultos")
    const md = documentToMarkdown(doc, DEFAULT_STYLE, detalhado)
    expect(md.match(/CAMPOS OCULTOS/g)).toHaveLength(1)
    expect(md).toContain("Agrupamento de campos ocultos")
  })
})
