import { describe, expect, it, vi } from "vitest"
import sharp from "sharp"

vi.mock("@/lib/integration-config", () => ({ getIntegrationConfig: async () => ({ timeoutMs: 1000, maxRetries: 0, retryDelayMs: 0 }) }))

import { contentHashName, prepareUpload } from "./upload"

describe("prepareUpload", () => {
  it("converts PNG to WebP and caps the size at 2000px", async () => {
    const png = await sharp({ create: { width: 3000, height: 1000, channels: 3, background: "#15803d" } }).png().toBuffer()
    const out = await prepareUpload(png, "image/png", "logo.png")
    expect(out.contentType).toBe("image/webp")
    expect(out.extension).toBe(".webp")
    const meta = await sharp(out.body).metadata()
    expect(meta.format).toBe("webp")
    expect(meta.width).toBe(2000)
  })

  it("keeps SVG untouched", async () => {
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>')
    const out = await prepareUpload(svg, "image/svg+xml", "a.svg")
    expect(out.body).toBe(svg)
    expect(out.extension).toBe(".svg")
  })

  it("stores undecodable bytes as sent", async () => {
    const junk = Buffer.from("not an image")
    const out = await prepareUpload(junk, "image/png", "x.png")
    expect(out.contentType).toBe("image/png")
    expect(out.body).toBe(junk)
  })

  it("names by content hash", () => {
    expect(contentHashName(Buffer.from("a"), ".webp")).toBe(contentHashName(Buffer.from("a"), ".webp"))
    expect(contentHashName(Buffer.from("a"), ".webp")).not.toBe(contentHashName(Buffer.from("b"), ".webp"))
  })
})
