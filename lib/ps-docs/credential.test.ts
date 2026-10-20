import { describe, expect, it } from "vitest"
import { buildCookieHeader, decodeXsrf, missingCookieNames, parseCookieString } from "./credential"

const SAMPLE =
  "branch=master; client_id=eyJpdiI6Ik9x%3D%3D; inscricoes_session=eyJpdiI6IkZU%3D; XSRF-TOKEN=eyJpdiI6IkV4%3D%3D"

describe("parseCookieString", () => {
  it("extracts the four cookies from a pasted Cookie header", () => {
    expect(parseCookieString(SAMPLE)).toEqual({
      branch: "master",
      clientId: "eyJpdiI6Ik9x%3D%3D",
      session: "eyJpdiI6IkZU%3D",
      xsrf: "eyJpdiI6IkV4%3D%3D",
    })
  })

  it("keeps trailing = of base64 values and decodes the XSRF header", () => {
    const c = parseCookieString("client_id=abc==; inscricoes_session=s; XSRF-TOKEN=x%3D")
    expect(c.clientId).toBe("abc==")
    expect(decodeXsrf(c.xsrf)).toBe("x=")
  })

  it("tolerates a Cookie: prefix, line breaks, extra cookies, any order and case", () => {
    const c = parseCookieString("Cookie: xsrf-token=x;\n_ga=GA1.2; Inscricoes_Session=s\r\nclient_id=c;")
    expect(c).toEqual({ branch: "master", clientId: "c", session: "s", xsrf: "x" })
  })

  it("rebuilds a header with only the known cookies", () => {
    expect(buildCookieHeader(parseCookieString(`_ga=1; ${SAMPLE}`))).toBe(SAMPLE)
  })
})

describe("missingCookieNames", () => {
  it("is empty for a complete cookie", () => {
    expect(missingCookieNames(SAMPLE)).toEqual([])
  })

  it("lists the required cookies that are absent", () => {
    expect(missingCookieNames("branch=master; inscricoes_session=s")).toEqual(["client_id", "XSRF-TOKEN"])
    expect(missingCookieNames("")).toEqual(["client_id", "inscricoes_session", "XSRF-TOKEN"])
  })
})
