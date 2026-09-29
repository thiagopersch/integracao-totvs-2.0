"use client";

import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { PeriodSelect } from "@/components/shared/period-select";
import type { ExportPeriod } from "@/lib/export-period";
import type { Period } from "@/lib/period";

export type ExportPeriodSelection =
  | { kind: "none" }
  | { kind: "yearMonth"; period: Period | null }
  | { kind: "last7days" }
  | { kind: "last15days" }
  | { kind: "lastMonth" }
  | { kind: "last6months" }
  | { kind: "lastYear" }
  | { kind: "custom"; range: DateRange | undefined };

type PresetKind = ExportPeriodSelection["kind"];

const PRESET_LABELS: Record<PresetKind, string> = {
  none: "Todos os períodos",
  yearMonth: "Ano e Mês",
  last7days: "Últimos 7 dias",
  last15days: "Últimos 15 dias",
  lastMonth: "Mês passado",
  last6months: "Últimos 6 meses",
  lastYear: "Último ano",
  custom: "Período específico",
};

const PRESET_ORDER: PresetKind[] = ["none", "yearMonth", "last7days", "last15days", "lastMonth", "last6months", "lastYear", "custom"];

/** `true` while the user picked a type that needs a further choice (year, or a date range) but
 *  hasn't made it yet — callers use this to keep export actions disabled until then. */
export function isExportPeriodPending(selection: ExportPeriodSelection): boolean {
  if (selection.kind === "yearMonth") return !selection.period;
  if (selection.kind === "custom") return !selection.range?.from || !selection.range?.to;
  return false;
}

export function toExportPeriod(selection: ExportPeriodSelection): ExportPeriod | null {
  switch (selection.kind) {
    case "none":
      return null;
    case "yearMonth":
      return selection.period ? { kind: "yearMonth", period: selection.period } : null;
    case "custom":
      return selection.range?.from && selection.range?.to
        ? { kind: "custom", from: format(selection.range.from, "yyyy-MM-dd"), to: format(selection.range.to, "yyyy-MM-dd") }
        : null;
    default:
      return { kind: selection.kind };
  }
}

type Props = {
  years: number[];
  monthsByYear: Record<number, number[]>;
  value: ExportPeriodSelection;
  onChange: (value: ExportPeriodSelection) => void;
};

export function ExportPeriodSelect({ years, monthsByYear, value, onChange }: Props) {
  function handlePresetChange(kind: PresetKind) {
    if (kind === "yearMonth") return onChange({ kind, period: null });
    if (kind === "custom") return onChange({ kind, range: undefined });
    return onChange({ kind });
  }

  return (
    <div className="space-y-2">
      <Select
        items={PRESET_ORDER.map((p) => ({ value: p, label: PRESET_LABELS[p] }))}
        value={value.kind}
        onValueChange={(v) => handlePresetChange((v || "none") as PresetKind)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PRESET_ORDER.map((p) => (
            <SelectItem key={p} value={p}>
              {PRESET_LABELS[p]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {value.kind === "yearMonth" && (
        <PeriodSelect
          years={years}
          monthsByYear={monthsByYear}
          value={value.period}
          onChange={(p) => onChange({ kind: "yearMonth", period: p })}
        />
      )}

      {value.kind === "custom" && (
        <DateRangePicker
          value={value.range}
          onValueChange={(range) => onChange({ kind: "custom", range })}
          placeholder="Selecione a data inicial e final"
        />
      )}
    </div>
  );
}
