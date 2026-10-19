import * as XLSX from "xlsx";
import { autoSizedSheet } from "@/lib/demands-xlsx";
import { USAGE_LEVEL_LABELS, type UsageLevel } from "@/lib/contract-usage";

export interface UsageSheetRow {
  clientName: string;
  baseHours: number;
  extraHours: number;
  contractedHours: number;
  usedHours: number;
  demandsCount: number;
  percent: number;
  level: UsageLevel;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

const HEADER = [
  "Cliente",
  "Horas do contrato",
  "Horas extras",
  "Horas contratadas",
  "Horas utilizadas",
  "Saldo",
  "Excedente",
  "Consumo (%)",
  "Situação",
  "Demandas",
];

/** ALL_CLIENTS consumption email attachment: one row per client in the reference month, plus a total row. */
export function contractUsageXlsxBuffer(rows: UsageSheetRow[], periodLabel: string): Buffer {
  const toRow = (r: Omit<UsageSheetRow, "level"> & { level: string }) => ({
    Cliente: r.clientName,
    "Horas do contrato": r.baseHours,
    "Horas extras": r.extraHours,
    "Horas contratadas": r.contractedHours,
    "Horas utilizadas": r.usedHours,
    Saldo: round2(Math.max(r.contractedHours - r.usedHours, 0)),
    Excedente: round2(Math.max(r.usedHours - r.contractedHours, 0)),
    "Consumo (%)": round2(r.percent),
    Situação: r.level,
    Demandas: r.demandsCount,
  });
  const sum = (key: "baseHours" | "extraHours" | "contractedHours" | "usedHours" | "demandsCount") =>
    round2(rows.reduce((total, r) => total + r[key], 0));
  const contracted = sum("contractedHours");
  const used = sum("usedHours");
  const data = [
    ...rows.map((r) => toRow({ ...r, level: USAGE_LEVEL_LABELS[r.level] })),
    toRow({
      clientName: "Total",
      baseHours: sum("baseHours"),
      extraHours: sum("extraHours"),
      contractedHours: contracted,
      usedHours: used,
      demandsCount: sum("demandsCount"),
      percent: contracted > 0 ? (used / contracted) * 100 : 0,
      level: "",
    }),
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, autoSizedSheet(data, HEADER), `Consumo ${periodLabel}`.replace(/[[\]:*?/\\]+/g, "-").slice(0, 31));
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
