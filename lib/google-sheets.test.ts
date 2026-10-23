import { describe, expect, it } from "vitest";
import { parseServiceAccountKey, parseSpreadsheetId } from "@/lib/google-sheets";
import { demandsSummaryRows } from "@/lib/demands-xlsx";

describe("parseSpreadsheetId", () => {
  it("extracts the id from an edit link", () => {
    expect(parseSpreadsheetId("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-x/edit#gid=0")).toBe(
      "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-x"
    );
  });

  it("rejects links that are not spreadsheets", () => {
    expect(parseSpreadsheetId("https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz/edit")).toBeNull();
    expect(parseSpreadsheetId("qualquer coisa")).toBeNull();
  });
});

describe("parseServiceAccountKey", () => {
  it("accepts a service account key", () => {
    const key = parseServiceAccountKey(
      JSON.stringify({ type: "service_account", client_email: "sync@proj.iam.gserviceaccount.com", private_key: "-----BEGIN PRIVATE KEY-----" })
    );
    expect(key.client_email).toBe("sync@proj.iam.gserviceaccount.com");
  });

  it("rejects invalid JSON and other credential types", () => {
    expect(() => parseServiceAccountKey("{nope")).toThrow(/JSON/);
    expect(() => parseServiceAccountKey(JSON.stringify({ type: "authorized_user", client_email: "a", private_key: "b" }))).toThrow(
      /service_account/
    );
  });
});

describe("demandsSummaryRows", () => {
  it("adds a total row whose consumption only counts contracted clients", () => {
    const rows = demandsSummaryRows([
      { clientName: "A", rows: [], minutes: 600, executedMinutes: 600, scheduledMinutes: 0, usage: { baseHours: 20, extraHours: 0, contractedHours: 20 } },
      { clientName: "B", rows: [], minutes: 120, executedMinutes: 60, scheduledMinutes: 60, usage: null },
    ]);
    expect(rows).toHaveLength(3);
    expect(rows[0]["Consumo (%)"]).toBe(50);
    expect(rows[2]).toMatchObject({ Cliente: "Total", "Horas executadas": 11, "Horas contratadas": 20, "Consumo (%)": 50 });
    expect(rows[0]).not.toHaveProperty("Horas extras");
  });
});
