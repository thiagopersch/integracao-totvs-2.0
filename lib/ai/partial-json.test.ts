import { describe, expect, it } from "vitest"
import { parsePartialJson } from "./partial-json"

describe("parsePartialJson", () => {
  it("parses complete JSON", () => {
    expect(parsePartialJson('{"reply":"ok","records":[]}')).toEqual({ reply: "ok", records: [] })
  })
  it("closes an open string", () => {
    expect(parsePartialJson('{"reply":"Montei du')).toEqual({ reply: "Montei du" })
  })
  it("drops a dangling key", () => {
    expect(parsePartialJson('{"reply":"ok","rec')).toEqual({ reply: "ok" })
  })
  it("keeps finished array items and the one being written", () => {
    expect(parsePartialJson('{"records":[{"entity":"demand","values":{"name":"A"}},{"entity":"dem')).toEqual({
      records: [{ entity: "demand", values: { name: "A" } }, { entity: "dem" }],
    })
  })
  it("returns undefined for nothing yet", () => {
    expect(parsePartialJson("")).toBeUndefined()
  })
})
