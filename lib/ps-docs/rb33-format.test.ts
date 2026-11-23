import { describe, expect, it } from "vitest"
import { buildRb33Doc, logicaLines, ruleText, type Rb33Item } from "./rb33-format"
import { describeCustomValidation } from "./script-validation-text"
import { renderRb33Fragment, renderRb33StandaloneHtml } from "./render-rb33-html"
import { rb33ToMarkdown } from "./export-rb33-markdown"
import { docPreviewHtml, docStandaloneHtml } from "./doc-exports"
import { renderDocumentHtml } from "./render-html"
import { DEFAULT_DOC_OPTIONS, DEFAULT_STYLE, type DocumentacaoPS, type ItemSpec } from "./types"
import { sampleDetalhes, sampleDoc } from "./__fixtures__/sample-doc"

const opts = DEFAULT_DOC_OPTIONS
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

describe("buildRb33Doc", () => {
  const rb = buildRb33Doc(sampleDoc, opts)
  const etapa = rb.etapas[0]

  it("flattens agrupamentos and carries their display logic to the children", () => {
    const names = etapa.passos[0].itens.map((i) => i.nome)
    expect(names).toEqual(["Nome completo", "Laudo", "Aviso"])
    const laudo = etapa.passos[0].itens[1] as Rb33Item
    expect(laudo.cond).toContain("exibido se Possui deficiência igual a Sim")
  })

  it("moves buttons out of the field list into one actions table per button, pop-ups included", () => {
    expect(etapa.passos[0].itens.some((i) => i.nome === "Concluir")).toBe(false)
    expect(etapa.botoes[0].titulo).toBe("Ações ao clicar em “Concluir” (Passo: Dados)")
    const [consulta, salvar, enc] = etapa.botoes[0].linhas
    expect(consulta).toMatchObject({ tipo: "Ações TOTVS", titulo: "[FV#155]: Atualizar escola anterior", queryCode: "RB.PS.IM.007", logica: "Forma de ingresso está preenchido." })
    expect(salvar.tipo).toBe("Ações TOTVS (2º plano) — desativada")
    expect(enc).toMatchObject({ tipo: "Encaminhamento", descricao: "Abrir pop-up → Pop-up de aceite" })
  })

  it("generates the default logic and description sentences", () => {
    expect(etapa.logica[0]).toMatch(/^A etapa ficará disponível/)
    expect(etapa.descricao).toBe("Etapa inicial")
    const generated = buildRb33Doc({ ...sampleDoc, etapas: [{ ...sampleDoc.etapas[0], descricao: "Etapa composta por 2 passo(s): A, B.", passos: [sampleDoc.etapas[0].passos[0], sampleDoc.etapas[0].passos[0]] }, { ...sampleDoc.etapas[0] }] }, opts)
    expect(generated.etapas[0].descricao).toBe("Ao acessar, o candidato deverá preencher as informações solicitadas divididas em 2 passos.")
    expect(generated.etapas[1].logica[0]).toMatch(/^Sem restrição/)
  })

  it("marks required fields and checkbox tags, and describes TOTVS options with their cascade", () => {
    const campo = (nome: string, fieldId: number, sistema: string): ItemSpec => ({
      categoria: "campo",
      nome: `${nome} (${fieldId})`,
      tipo: "select",
      fieldId,
      nomeSistema: sistema,
      obrigatorio: true,
      integracaoTotvs: { sentenca: "RB.PS.IM.006", tabela: "SCURSO", campo: "CODCURSO" },
      detalhes: { ...sampleDetalhes, identidade: { ...sampleDetalhes.identidade, integracaoTotvs: { ativada: true, tabela: "SCURSO", campo: "CODCURSO" } } },
    })
    const check: ItemSpec = { categoria: "campo", nome: "Aceite", tipo: "checkbox", detalhes: { ...sampleDetalhes, identidade: { ...sampleDetalhes.identidade, tipoCampo: "Checkbox" }, validacoes: [] } }
    const doc: DocumentacaoPS = { ...sampleDoc, etapas: [{ ...sampleDoc.etapas[0], passos: [{ nome: "Curso", consultaSql: { configurada: false }, itens: [campo("Curso", 1, "Curso"), campo("Em que horário", 2, "Turno"), check] }] }] }
    const [curso, , aceite] = buildRb33Doc(doc, opts).etapas[0].passos[0].itens as Rb33Item[]
    expect(curso.obrigatorio).toBe(true)
    expect(curso.notas.map((n) => n.texto)).toContain("Opções carregadas dinamicamente via consulta TOTVS RB.PS.IM.006 (SCURSO.CODCURSO) — em cascata com: Turno.")
    expect(aceite.tag).toBe("Check")
  })

  it("explains fallback feedbacks", () => {
    const doc: DocumentacaoPS = { ...sampleDoc, etapas: [{ ...sampleDoc.etapas[0], feedbacks: [{ nome: "Concluída", condicao: "Sem condição própria — exibido quando nenhum outro feedback da etapa se aplica.", conclusivo: false }] }] }
    expect(buildRb33Doc(doc, opts).etapas[0].feedbacks[0]).toEqual({ rotulo: "Feedback 1 (Concluída): ", texto: "Sem lógica associada — único feedback da etapa." })
  })

  it("builds the subtitle from identifier, portal and process id", () => {
    expect(buildRb33Doc({ ...sampleDoc, identifier: "PRESENCIAL", idPortal: "4997" }, opts).subtitulo).toBe("identifier PRESENCIAL · portal 4997 · selective_process_id 5537")
  })
})

describe("logic wording", () => {
  it("rewrites operators and quotes values with spaces", () => {
    expect(ruleText({ campo: "Forma de ingresso (316201)", regra: "É igual a", valor: "PROFESSOR PRILEI" })).toBe("Forma de ingresso igual a “PROFESSOR PRILEI”")
    expect(ruleText({ campo: "Possuo nome social (1)", regra: "é igual", valor: "Selecionado" })).toBe("Possuo nome social igual a selecionado")
    expect(ruleText({ campo: "RA (2)", regra: "é conhecido" })).toBe("RA está preenchido")
  })

  it("ends rules with ; and the last one with a period, flagging OR", () => {
    expect(logicaLines({ condicao: "Se alguma dessas regras corresponder", regras: [{ campo: "A", regra: "é igual", valor: "T" }, { campo: "B", regra: "é igual", valor: "F" }] })).toEqual(["(basta uma das condições abaixo)", "A igual a T;", "B igual a F."])
  })
})

describe("describeCustomValidation", () => {
  const labels = new Map([["nacionalidade", "Nacionalidade"], ["possuoNomeSocial", "Possuo nome social"]])

  it("conditional required by value", () => {
    expect(describeCustomValidation(`valid = (data.nacionalidade == '10' && !input) ? 'Campo obrigatório' : true;`, labels)).toBe('Torna este campo obrigatório quando o campo “Nacionalidade” for igual a "10".')
    expect(describeCustomValidation(`valid = (data.nacionalidade !== "10" && !input) ? 'Obrigatório' : true;`, labels)).toBe('Torna este campo obrigatório quando o campo “Nacionalidade” for diferente de "10".')
  })

  it("conditional required by a checked checkbox", () => {
    expect(describeCustomValidation(`valid = (data.possuoNomeSocial && !input) ? 'Informe' : true;`, labels)).toBe("Torna este campo obrigatório quando o campo “Possuo nome social” está marcado.")
  })

  it("unknown key and value", () => {
    expect(describeCustomValidation(`if (!input && ['1','2'].includes(data.formaDeIngresso)) valid = 'x'; else valid = true;`, labels)).toBe(
      "Torna este campo obrigatório dependendo do valor do campo com identificador “formaDeIngresso” (não foi possível identificar automaticamente o valor exigido — revisar o script)."
    )
  })

  it("clears the value, age and words", () => {
    expect(describeCustomValidation(`if (!data.possuoNomeSocial) { instance.setValue(''); } valid = true;`, labels)).toBe("Ação automática: limpa o valor deste campo quando o campo “Possuo nome social” está desmarcado (não é uma checagem que gera erro).")
    expect(describeCustomValidation(`var idade = moment().diff(input, 'years'); valid = idade >= 16 ? true : 'Idade mínima';`)).toBe("Calcula a idade a partir da data informada neste campo e exige o limite >= 16 anos.")
    expect(describeCustomValidation(`var p = input.split(' '); valid = p.every(function(w){ return w.length > 1 && !/\\./.test(w) }) ? true : 'Não abrevie';`)).toMatch(/^Verifica palavra por palavra/)
  })

  it("falls back when unrecognised", () => {
    expect(describeCustomValidation(`valid = window.checaAlgo(input);`)).toMatch(/revisar o script direto no campo/)
    expect(describeCustomValidation(undefined)).toMatch(/revisar o script/)
  })
})

describe("RB-33 renderers", () => {
  it("fragment has numbered sections, the actions table and no detailed headings", () => {
    const out = text(renderRb33Fragment(sampleDoc, DEFAULT_STYLE, opts))
    for (const s of ["1. Lógica para exibição", "2. Descrição", "3. Passos", "4. Feedbacks", "5. Ações e integrações", "Tipo da ação", "RB.PS.IM.007"]) expect(out).toContain(s)
    expect(out).not.toContain("Identificação")
  })

  it("standalone page is self-contained with index, read-only text, edit/PDF buttons and print CSS", () => {
    const html = renderRb33StandaloneHtml([sampleDoc, { ...sampleDoc, idPs: "6000", tituloPortal: "Outro" }], DEFAULT_STYLE, opts)
    expect(html.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(html).toContain('<nav class="toc">')
    expect(html).toContain('class="toc-group">Outro<')
    expect(html).not.toMatch(/<[^>]*contenteditable=/)
    expect(html).toContain("data-editable-root")
    for (const id of ["btn-edit", "btn-print", "btn-save", "btn-reset"]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain("@media print")
    expect(html).toContain('id="ps6000-etapa-1"')
  })

  it("markdown carries the actions as a table", () => {
    const md = rb33ToMarkdown(sampleDoc, opts)
    expect(md).toContain("| Tipo da ação | Descrição da ação | Lógica da ação |")
    expect(md).toContain("**[FV#155]: Atualizar escola anterior** `(RB.PS.IM.007)`")
  })

  it("script code only appears when requested", () => {
    const campo: ItemSpec = { categoria: "campo", nome: "CPF", tipo: "text", detalhes: { ...sampleDetalhes, validacoes: [{ tipo: "Validação personalizada", ativado: true, codigo: "valid = window.x(input);" }] } }
    const doc: DocumentacaoPS = { ...sampleDoc, etapas: [{ ...sampleDoc.etapas[0], passos: [{ nome: "P", consultaSql: { configurada: false }, itens: [campo] }] }] }
    expect(renderRb33Fragment(doc, DEFAULT_STYLE, opts)).not.toContain("window.x")
    expect(renderRb33Fragment(doc, DEFAULT_STYLE, { ...opts, incluirCodigoScript: true })).toContain("window.x")
  })

  it("the detailed standalone page gets the same read-only editor bar", () => {
    const html = docStandaloneHtml([sampleDoc], DEFAULT_STYLE, { ...opts, modelo: "detalhado" })
    expect(html).not.toMatch(/<[^>]*contenteditable=/)
    expect(html).toContain("<main data-editable-root")
    for (const id of ["btn-edit", "btn-print", "btn-save"]) expect(html).toContain(`id="${id}"`)
    expect(html).toContain(renderDocumentHtml(sampleDoc, DEFAULT_STYLE, { ...opts, modelo: "detalhado" }))
  })

  it("the dispatcher keeps the detailed model unchanged", () => {
    const detalhado = { ...opts, modelo: "detalhado" as const }
    expect(docPreviewHtml(sampleDoc, DEFAULT_STYLE, detalhado)).toBe(renderDocumentHtml(sampleDoc, DEFAULT_STYLE, detalhado))
  })
})
