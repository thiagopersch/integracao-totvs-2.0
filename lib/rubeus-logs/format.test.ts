import { describe, expect, it } from "vitest"
import {
  EMPTY_PAYLOAD_MESSAGE,
  dash,
  durationSeconds,
  formatDurationSeconds,
  formatLogDate,
  formatPayload,
  isDownloadUrl,
  logTypeLabel,
  logsToSheetRows,
  toTsv,
  LOG_SHEET_HEADERS,
} from "@/lib/rubeus-logs/format"
import type { RubeusLogRow } from "@/lib/rubeus-logs/types"

describe("rubeus log formatting", () => {
  it("maps log_type_id 1 to Erro and anything else to Info", () => {
    expect(logTypeLabel(1)).toBe("Erro")
    expect(logTypeLabel(0)).toBe("Info")
    expect(logTypeLabel(null)).toBe("Info")
    expect(logTypeLabel(2)).toBe("Info")
  })

  it("converts milliseconds to seconds", () => {
    expect(durationSeconds(12502)).toBe(12.5)
    expect(durationSeconds(349)).toBe(0.35)
    expect(durationSeconds(null)).toBeNull()
    expect(formatDurationSeconds(12502)).toBe("12,5 segundos")
    expect(formatDurationSeconds(128)).toBe("0,13 segundos")
    expect(formatDurationSeconds(undefined)).toBe("-")
  })

  it("formats Rubeus dates without timezone shifts", () => {
    expect(formatLogDate("2026-11-23 12:59:32")).toBe("23/11/2026 12:59:32")
    expect(formatLogDate(null)).toBe("-")
  })

  it("renders blanks as a dash", () => {
    expect(dash(null)).toBe("-")
    expect(dash("  ")).toBe("-")
    expect(dash(21996)).toBe("21996")
  })

  it("detects signed file links", () => {
    expect(isDownloadUrl("https://storage.googleapis.com/rb-arquivos/logs/x.log?X-Goog-Expires=7200")).toBe(true)
    expect(isDownloadUrl('{"codSentenca":"RB"}')).toBe(false)
    expect(isDownloadUrl("")).toBe(false)
  })

  it("formats payloads", () => {
    expect(formatPayload("")).toEqual({ kind: "empty", text: EMPTY_PAYLOAD_MESSAGE })
    expect(formatPayload('{"a":"1","b":[1]}')).toEqual({ kind: "json", text: '{\n  "a": "1",\n  "b": [\n    1\n  ]\n}' })
    expect(formatPayload('"<h1>Acesso bloque\\u00e1do<\\/h1>\\nok"')).toEqual({ kind: "text", text: "<h1>Acesso bloqueádo</h1>\nok" })
    expect(formatPayload('"{\\"x\\":1}"')).toEqual({ kind: "json", text: '{\n  "x": 1\n}' })
    expect(formatPayload("plain text")).toEqual({ kind: "text", text: "plain text" })
    expect(formatPayload("[]").kind).toBe("empty")
  })

  it("builds a TSV for Google Sheets", () => {
    const row: RubeusLogRow = {
      id: 407358,
      description: null,
      portal_id: 5086,
      duration: 128,
      portal_title: "Instituição Toledo de Ensino",
      selective_process_id: 21996,
      selective_process_title: "VESTIBULAR 2027/1 - ENEM",
      created_at: "2026-11-23 12:54:30",
      categories_title: "Integração TOTVS Pagamento Instantâneo",
      categories_id: "12",
      log_type_id: 1,
      person_name: "JOÃO\tPEDRO",
    }
    const tsv = toTsv(LOG_SHEET_HEADERS, logsToSheetRows([row]))
    const [header, line] = tsv.split("\n")
    expect(header.split("\t")).toHaveLength(LOG_SHEET_HEADERS.length)
    expect(line).toBe("407358\tErro\t23/11/2026 12:54:30\tIntegração TOTVS Pagamento Instantâneo\t-\tInstituição Toledo de Ensino\t21996\tVESTIBULAR 2027/1 - ENEM\tJOÃO PEDRO\t0,13")
  })
})
