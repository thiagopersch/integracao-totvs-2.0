"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Period } from "@/lib/period";

const MONTH_LABELS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

type Props = {
  years: number[];
  monthsByYear: Record<number, number[]>;
  value: Period | null;
  onChange: (period: Period | null) => void;
};

export function PeriodSelect({ years, monthsByYear, value, onChange }: Props) {
  const availableMonths = value ? (monthsByYear[value.year] ?? []) : [];

  return (
    <div className="flex items-center gap-2">
      <Select
        items={[{ value: "all", label: "Todos" }, ...years.map((y) => ({ value: String(y), label: String(y) }))]}
        value={value ? String(value.year) : "all"}
        onValueChange={(v) => onChange(v === "all" || !v ? null : { year: Number(v) })}
      >
        <SelectTrigger className="w-[110px]">
          <SelectValue placeholder="Ano" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={[
          { value: "all", label: "Todos" },
          ...availableMonths.map((m) => ({ value: String(m), label: MONTH_LABELS[m - 1] })),
        ]}
        value={value?.month ? String(value.month) : "all"}
        onValueChange={(v) => {
          if (!value) return;
          onChange({ year: value.year, month: v === "all" || !v ? undefined : Number(v) });
        }}
        disabled={!value}
      >
        <SelectTrigger className="w-[140px]">
          <SelectValue placeholder="Mês" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos</SelectItem>
          {availableMonths.map((m) => (
            <SelectItem key={m} value={String(m)}>
              {MONTH_LABELS[m - 1]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
