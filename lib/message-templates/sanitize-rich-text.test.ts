import { describe, expect, it } from "vitest"
import { sanitizeRichText } from "./render-email"

describe("sanitizeRichText", () => {
  it.each([
    ["<svg/onload=alert(1)>", "onload"],
    ['<img src=x onerror="alert(1)">', "onerror"],
    ["<a href=javascript:alert(1)>x</a>", "javascript:"],
    ['<a href="jav&#x09;ascript:alert(1)">x</a>', "ascript:"],
    ["<p><script>alert(1)</script>oi</p>", "<script"],
    ['<iframe src="https://evil"></iframe>', "<iframe"],
    ['<p style="background:url(javascript:alert(1))">x</p>', "url("],
    ["<details open ontoggle=alert(1)>", "ontoggle"],
  ])("neutralizes %s", (input, forbidden) => {
    expect(sanitizeRichText(input).toLowerCase()).not.toContain(forbidden)
  })

  it("keeps editor markup", () => {
    const html = '<h2 style="text-align:center">Título</h2><p>Olá <strong>{{nome}}</strong>, <a href="https://x.com" target="_blank">link</a></p><ul><li>a</li></ul>'
    expect(sanitizeRichText(html)).toBe(html)
  })
})
