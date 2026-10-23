import { describe, expect, it } from "vitest";
import {
  columnLetter,
  detectTimesheetLayout,
  formatHours,
  monthTabTitle,
  parseHours,
  parseMonthTab,
  toSheetDate,
} from "@/lib/sheet-timesheet";

/** Same shape as the "Outubro26" tab of the "Apontamento de horas - Parceiro implementador" template. */
function octoberGrid() {
  const grid: unknown[][] = [
    [],
    ["Apontamento de horas - Parceiro implementador"],
    [],
    ["Empresa parceira:", "CoreShark - Consultoria Estratégica"],
    ["Analista responsável:", "Tiago Persch"],
    ["Período:", "01/10/2026 a 31/10/2026"],
    ["Horas contratadas:", "30 horas"],
    ["Horas excedentes:", "0 horas"],
    [],
    ["DATA ", "NOME DO ANALISTA", "HORAS EXECUTADAS", "DEMANDA", "DESCRIÇÃO ", "SOLICITANTE", "SETOR"],
    [46297, "Tiago Persch", 3, "Reunião de alinhamento", "Alinhamento das novas fichas", "Tiago Persch", "Analista"],
  ];
  while (grid.length < 67) grid.push([]);
  grid.push(["TOTAL DE HORAS APONTADAS", "", "=SOMA(C11:C67)"]);
  return grid;
}

describe("parseMonthTab", () => {
  it("reads the month tabs in their usual spellings", () => {
    expect(parseMonthTab("Outubro26")).toEqual({ year: 2026, month: 10 });
    expect(parseMonthTab("novembro 26")).toEqual({ year: 2026, month: 11 });
    expect(parseMonthTab("MARÇO 2027")).toEqual({ year: 2027, month: 3 });
    expect(parseMonthTab("Janeiro27")).toEqual({ year: 2027, month: 1 });
  });

  it("ignores other tabs", () => {
    expect(parseMonthTab("Resumo")).toBeNull();
    expect(parseMonthTab("Outubro")).toBeNull();
    expect(parseMonthTab("Foo26")).toBeNull();
  });
});

describe("monthTabTitle", () => {
  it("follows the style of the previous month tab", () => {
    expect(monthTabTitle({ year: 2026, month: 11 }, "Outubro26")).toBe("Novembro26");
    expect(monthTabTitle({ year: 2027, month: 1 }, "Dezembro26")).toBe("Janeiro27");
    expect(monthTabTitle({ year: 2027, month: 3 }, "fevereiro 2027")).toBe("março 2027");
    expect(monthTabTitle({ year: 2026, month: 12 }, "NOVEMBRO 26")).toBe("DEZEMBRO 26");
    expect(monthTabTitle({ year: 2026, month: 11 })).toBe("Novembro26");
  });
});

describe("detectTimesheetLayout", () => {
  it("finds the header, the TOTAL row and the header block cells", () => {
    const layout = detectTimesheetLayout(octoberGrid())!;
    expect(layout.headerRow).toBe(9);
    expect(layout.firstDataRow).toBe(10);
    expect(layout.totalRow).toBe(67);
    expect(layout.columns).toEqual({ date: 0, analyst: 1, hours: 2, name: 3, description: 4, requester: 5, department: 6 });
    expect(layout.periodCell).toEqual({ row: 5, column: 1 });
    expect(layout.contractedCell).toEqual({ row: 6, column: 1 });
    expect(layout.excessCell).toEqual({ row: 7, column: 1 });
  });

  it("returns null without a DATA / HORAS header", () => {
    expect(detectTimesheetLayout([["Cliente", "Valor"]])).toBeNull();
  });
});

describe("cell helpers", () => {
  it("converts dates, hours and columns", () => {
    expect(toSheetDate(new Date(Date.UTC(2026, 9, 2)))).toBe(46297);
    expect(formatHours(2.5)).toBe("2,5 horas");
    expect(formatHours(0)).toBe("0 horas");
    expect(parseHours("30 horas")).toBe(30);
    expect(parseHours("—")).toBeNull();
    expect(columnLetter(0)).toBe("A");
    expect(columnLetter(26)).toBe("AA");
  });
});
