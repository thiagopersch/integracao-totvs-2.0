import { describe, expect, it } from "vitest"
import type { FieldSearchHit } from "./field-search"
import { componenteLabel, hitsToMarkdown, hitsToSheetRows, hitsToText } from "./field-search-export"

const hit = (over: Partial<FieldSearchHit>): FieldSearchHit => ({
  id: Math.random().toString(),
  portal: "3734 | Portal Santa Cruz",
  processo: "2207 | Vestibular 2027",
  etapa: "Dados de inscrição",
  passo: "Passo 2",
  componente: "Concluir",
  nomeComponente: "[MELHORIA | SANTA CRUZ] - Cadastrar escolas",
  categoria: "Botão",
  tipoUso: "Ação do botão",
  oculto: "—",
  ...over,
})

const hits: FieldSearchHit[] = [
  hit({ acao: "[FV#155]: Atualizar escolar_anterior", coluna: "IDFV", valor: "155", detalheUso: "3. … — coluna IDFV = Valor fixo: 155" }),
  hit({ componente: "Nome completo", nomeComponente: "nome completo", categoria: "Campo (textfield)", tipoUso: "Componente", oculto: "Sim", motivoOculto: "classe ps-input-hidden" }),
  hit({ processo: "—", etapa: undefined, passo: undefined, pagina: "Minha página", componente: "Escola", nomeComponente: undefined, tipoUso: "Componente", oculto: "Não" }),
]

describe("componenteLabel", () => {
  it("joins label and internal name, skipping a repeated name", () => {
    expect(componenteLabel(hits[0])).toBe("Concluir | [MELHORIA | SANTA CRUZ] - Cadastrar escolas")
    expect(componenteLabel(hits[1])).toBe("Nome completo")
  })
})

describe("hitsToMarkdown", () => {
  const md = hitsToMarkdown(hits, "IDFV")

  it("groups by portal › processo › etapa › passo without repeating headings", () => {
    expect(md.match(/^## Portal: 3734 \| Portal Santa Cruz$/gm)).toHaveLength(1)
    expect(md.match(/^### Processo: 2207 \| Vestibular 2027$/gm)).toHaveLength(1)
    expect(md.match(/^\*\*Passo: Passo 2\*\*$/gm)).toHaveLength(1)
  })

  it("stops headings at level 3, counts elements and has no blank lines (Discord)", () => {
    expect(md).not.toMatch(/^#{4,} /m)
    expect(md).toContain("**Etapa: Dados de inscrição**")
    expect(md.split("\n")[1]).toBe("3 elementos encontrados")
    expect(md.trimEnd()).not.toContain("\n\n")
    expect(hitsToMarkdown([hits[0]], "x").split("\n")[1]).toBe("1 elemento encontrado")
  })

  it("lists action, column and value, escaping Markdown", () => {
    expect(md).toContain("  - **Ação:** [FV#155]: Atualizar escolar\\_anterior")
    expect(md).toContain("  - **Coluna:** `IDFV`")
    expect(md).toContain("  - **Valor:** `155`")
  })

  it("omits empty fields and shows hidden reasons", () => {
    expect(md).not.toContain("Feedback")
    expect(md).toContain("  - **Oculto:** Sim — classe ps-input-hidden")
    expect(md).toContain("  - **Página:** Minha página")
  })
})

describe("hitsToText", () => {
  it("indents by level and omits empty fields", () => {
    const text = hitsToText(hits, "IDFV")
    expect(text).toContain('BUSCA DE CAMPOS PS — "IDFV" (3 ocorrência(s))')
    expect(text).toContain("      Passo: Passo 2\n        • Concluir | [MELHORIA | SANTA CRUZ] - Cadastrar escolas\n            Uso: Ação do botão")
    expect(text).toContain("            Coluna: IDFV\n            Valor: 155")
    expect(text).not.toContain("Feedback")
  })
})

describe("hitsToSheetRows", () => {
  it("mirrors the table columns, with Portal only in portal mode", () => {
    const [row] = hitsToSheetRows(hits, { includePortal: true })
    expect(Object.keys(row)).toEqual([
      "Portal", "Processo", "Etapa", "Passo", "Feedback", "Página", "Pop-up", "Campo / componente", "Categoria", "ID do campo",
      "Agrupamento", "Tipo de uso", "Ação", "Coluna", "Valor", "Detalhe", "Oculto", "Motivo oculto",
    ])
    expect(row).toMatchObject({ Coluna: "IDFV", Valor: "155", "Campo / componente": "Concluir | [MELHORIA | SANTA CRUZ] - Cadastrar escolas" })
    expect(Object.keys(hitsToSheetRows(hits, { includePortal: false })[0])).not.toContain("Portal")
  })
})
