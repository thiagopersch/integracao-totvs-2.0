import { describe, expect, it } from "vitest"
import { tokenize } from "./code-highlight"

describe("tokenize", () => {
  it("keeps an HTML <script> body as-is (no leaked language-javascript span)", () => {
    const code = "<script>\n  let RBLib;\n</script>"
    const tokens = tokenize(code, "html")
    expect(tokens.map((t) => t.text).join("")).toBe(code)
    expect(tokens.find((t) => t.text === "let")?.kind).toBe("keyword")
    expect(tokens.find((t) => t.text.includes("script"))?.kind).toBe("name")
  })
})
