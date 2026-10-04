import { describe, expect, it } from "vitest"
import { formatPhone, isValidPhone } from "./masks"

describe("formatPhone", () => {
  it("masks as the user types", () => {
    expect(formatPhone("11")).toBe("(11")
    expect(formatPhone("119876")).toBe("(11) 9876")
    expect(formatPhone("1132345678")).toBe("(11) 3234-5678")
    expect(formatPhone("11987654321")).toBe("(11) 98765-4321")
    expect(formatPhone("119876543210")).toBe("(11) 98765-4321")
  })
})

describe("isValidPhone", () => {
  it("accepts mobile and landline numbers, masked or not", () => {
    expect(isValidPhone("(11) 98765-4321")).toBe(true)
    expect(isValidPhone("11987654321")).toBe(true)
    expect(isValidPhone("(51) 3234-5678")).toBe(true)
  })

  it("rejects incomplete numbers", () => {
    expect(isValidPhone("")).toBe(false)
    expect(isValidPhone("(11) 9876-543")).toBe(false)
  })

  it("rejects invalid DDDs", () => {
    expect(isValidPhone("(00) 3234-5678")).toBe(false)
    expect(isValidPhone("(01) 98765-4321")).toBe(false)
    expect(isValidPhone("(10) 98765-4321")).toBe(false)
  })

  it("rejects mobiles not starting with 9 and landlines not starting with 2–5", () => {
    expect(isValidPhone("(11) 88765-4321")).toBe(false)
    expect(isValidPhone("(11) 9234-5678")).toBe(false)
    expect(isValidPhone("(11) 1234-5678")).toBe(false)
  })

  it("rejects repeated digits", () => {
    expect(isValidPhone("(11) 11111-1111")).toBe(false)
  })
})
