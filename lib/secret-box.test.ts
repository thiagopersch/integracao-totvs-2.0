import { randomBytes } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { decryptSecret, encryptSecret, isEncrypted } from "./secret-box"

const KEY = randomBytes(32).toString("base64")

describe("secret-box", () => {
  let previous: string | undefined
  beforeEach(() => {
    previous = process.env.CREDENTIALS_ENCRYPTION_KEY
    process.env.CREDENTIALS_ENCRYPTION_KEY = KEY
  })
  afterEach(() => {
    if (previous === undefined) delete process.env.CREDENTIALS_ENCRYPTION_KEY
    else process.env.CREDENTIALS_ENCRYPTION_KEY = previous
  })

  it.each(["totvs@123", "", "senha com espaço ç ã é 🔐", "a:b:c;d=e&f<g>\"'", "x".repeat(500)])(
    "round-trips %j exactly",
    (plain) => {
      const enc = encryptSecret(plain)
      expect(isEncrypted(enc)).toBe(true)
      expect(enc).not.toContain(plain || "\u0000")
      expect(decryptSecret(enc)).toBe(plain)
    }
  )

  it("uses a random IV (same input → different ciphertext)", () => {
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"))
  })

  it("returns legacy plain-text values unchanged", () => {
    expect(decryptSecret("plain-legacy-password")).toBe("plain-legacy-password")
  })

  it("does not double-encrypt", () => {
    const enc = encryptSecret("abc")
    expect(encryptSecret(enc)).toBe(enc)
  })

  it("rejects a tampered value", () => {
    const enc = encryptSecret("abc")
    const parts = enc.split(":")
    const data = Buffer.from(parts[4], "base64")
    data[0] ^= 0xff
    parts[4] = data.toString("base64")
    expect(() => decryptSecret(parts.join(":"))).toThrow(/descriptografar/)
  })

  it("rejects a value encrypted with another key", () => {
    const enc = encryptSecret("abc")
    process.env.CREDENTIALS_ENCRYPTION_KEY = randomBytes(32).toString("base64")
    expect(() => decryptSecret(enc)).toThrow(/descriptografar/)
  })

  it("fails clearly when the key is missing or malformed", () => {
    delete process.env.CREDENTIALS_ENCRYPTION_KEY
    expect(() => encryptSecret("abc")).toThrow(/CREDENTIALS_ENCRYPTION_KEY ausente/)
    process.env.CREDENTIALS_ENCRYPTION_KEY = "short"
    expect(() => encryptSecret("abc")).toThrow(/inválida/)
  })
})
