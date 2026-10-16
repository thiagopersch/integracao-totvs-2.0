import { describe, expect, it } from "vitest"
import { Prisma } from "@/generated/prisma/client"
import { isMissingTableError } from "./prisma-errors"

const known = (code: string) => new Prisma.PrismaClientKnownRequestError("x", { code, clientVersion: "test" })

describe("isMissingTableError", () => {
  it("detects missing tables/columns only", () => {
    expect(isMissingTableError(known("P2021"))).toBe(true)
    expect(isMissingTableError(known("P2022"))).toBe(true)
    expect(isMissingTableError(known("P2002"))).toBe(false)
    expect(isMissingTableError(new Error("P2021"))).toBe(false)
  })
})
