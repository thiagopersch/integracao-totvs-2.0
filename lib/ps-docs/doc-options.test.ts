import { describe, expect, it } from "vitest"
import { renderDocumentHtml, renderPortalOverviewHtml } from "./render-html"
import { documentToMarkdown, portalOverviewToMarkdown } from "./export-markdown"
import { DEFAULT_DOC_OPTIONS, DEFAULT_STYLE, type DocOptions } from "./types"
import { sampleDoc, sampleOverview } from "./__fixtures__/sample-doc"

const opts = (patch: Partial<DocOptions>): DocOptions => ({ ...DEFAULT_DOC_OPTIONS, ...patch })
const text = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ")

/** Both the HTML and the Markdown renderer, reduced to plain text so the same assertions apply. */
const renders = (o: DocOptions) => [
  ["html", text(renderDocumentHtml(sampleDoc, DEFAULT_STYLE, o))],
  ["md", documentToMarkdown(sampleDoc, DEFAULT_STYLE, o).replace(/\*/g, "")],
] as const

describe("DocOptions defaults", () => {
  it("passing the defaults is the same as not passing options", () => {
    expect(renderDocumentHtml(sampleDoc, DEFAULT_STYLE, DEFAULT_DOC_OPTIONS)).toBe(renderDocumentHtml(sampleDoc, DEFAULT_STYLE))
    expect(documentToMarkdown(sampleDoc, DEFAULT_STYLE, DEFAULT_DOC_OPTIONS)).toBe(documentToMarkdown(sampleDoc, DEFAULT_STYLE))
  })
})

describe.each([["html"], ["md"]] as const)("%s renderer", (kind) => {
  const pick = (o: DocOptions) => renders(o).find(([k]) => k === kind)![1]

  it("campos = Não: lists the campo names without their detail, keeping their logic", () => {
    const out = pick(opts({ detalhesCampos: false }))
    expect(out).not.toContain("Identificação")
    expect(out).not.toContain("Esconder rótulo")
    expect(out).toContain("Campo: Nome completo (316100)")
    expect(out).toContain("Campo: Laudo (316101)")
    expect(out).toContain("Possui deficiência (316200) → É igual a → Sim")
    // components still detailed
    expect(out).toContain("Personalização")
  })

  it("componentes = Não: lists the componentes, keeps logic and the campos' own detail", () => {
    const out = pick(opts({ detalhesComponentes: false }))
    expect(out).not.toContain("Personalização")
    expect(out).not.toContain("Tema do botão")
    expect(out).toContain("Agrupamento: Dados pessoais")
    expect(out).toContain("Texto: Aviso")
    expect(out).toContain("Botão: Concluir")
    expect(out).toContain("Possui deficiência (316200) → É igual a → Sim")
    // campos (including the one nested in the compact agrupamento) keep their detail
    expect(out).toContain("Identificação")
    expect(out).toContain("Laudo (316101)")
    // ações are independent from the componentes answer
    expect(out).toContain("Tipo da ação:")
  })

  it("ações = Não: only the ação/encaminhamento names, with their logic", () => {
    const out = pick(opts({ detalhesAcoesBotao: false }))
    expect(out).not.toContain("Tipo da ação:")
    expect(out).not.toContain("Código da consulta")
    expect(out).not.toContain("Permite fechar")
    expect(out).toContain("[FV#155]: Atualizar escola anterior")
    expect(out).toContain("[2] Salvar dados")
    expect(out).toContain("[desativada]")
    expect(out).toContain("Abrir pop-up → Pop-up de aceite")
    expect(out).toContain("Forma de ingresso (316201) → É conhecido")
    // the botão itself is still detailed
    expect(out).toContain("Tema do botão")
  })

  it("everything Não: a compact botão still lists its ações by name", () => {
    const out = pick(opts({ detalhesCampos: false, detalhesComponentes: false, detalhesAcoesBotao: false }))
    expect(out).not.toContain("Identificação")
    expect(out).not.toContain("Personalização")
    expect(out).not.toContain("Tipo da ação:")
    expect(out).toContain("Botão: Concluir")
    expect(out).toContain("[FV#155]: Atualizar escola anterior")
    // etapa-level sections are untouched
    expect(out).toContain("Lógica de exibição")
    expect(out).toContain("Feedbacks")
  })
})

describe("portal overview", () => {
  it("campos = Não renders the portal campos as names only", () => {
    const html = text(renderPortalOverviewHtml(sampleOverview, DEFAULT_STYLE, opts({ detalhesCampos: false })))
    const md = portalOverviewToMarkdown(sampleOverview, DEFAULT_STYLE, opts({ detalhesCampos: false }))
    for (const out of [html, md]) {
      expect(out).not.toContain("Identificação")
      expect(out).toContain("Campo de oferta de curso")
    }
    expect(html).toContain("Curso (316300)")
    expect(md).toContain("Curso *(316300)*")
  })
})

describe("docx renderer", () => {
  it("builds with every combination of options", async () => {
    const { buildDocx, buildPortalOverviewDocx } = await import("./export-docx")
    for (const c of [true, false])
      for (const f of [true, false])
        for (const a of [true, false]) {
          const o = opts({ detalhesComponentes: c, detalhesCampos: f, detalhesAcoesBotao: a })
          expect((await buildDocx(sampleDoc, DEFAULT_STYLE, o)).size).toBeGreaterThan(0)
          expect((await buildPortalOverviewDocx(sampleOverview, DEFAULT_STYLE, o)).size).toBeGreaterThan(0)
        }
  })
})
