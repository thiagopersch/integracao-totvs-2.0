"use client";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ALL_CHART_KINDS, CHART_KIND_LABELS, type ChartKind, type ChartSeries } from "./chart-types";

interface Props {
  value: ChartKind;
  onChange: (kind: ChartKind) => void;
  allowedKinds?: ChartKind[];
  series?: ChartSeries[];
  measure?: string;
  onMeasureChange?: (key: string) => void;
}

export function ChartTypeSelect({ value, onChange, allowedKinds = ALL_CHART_KINDS, series, measure, onMeasureChange }: Props) {
  const showMeasure = (value === "pie" || value === "donut") && !!series && series.length > 1 && !!onMeasureChange;

  return (
    <div className="flex items-center gap-2">
      <Select
        items={allowedKinds.map((k) => ({ value: k, label: CHART_KIND_LABELS[k] }))}
        value={value}
        onValueChange={(v) => v && onChange(v as ChartKind)}
      >
        <SelectTrigger size="sm" className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowedKinds.map((k) => (
            <SelectItem key={k} value={k}>
              {CHART_KIND_LABELS[k]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showMeasure && (
        <Select
          items={series!.map((s) => ({ value: s.key, label: s.name }))}
          value={measure}
          onValueChange={(v) => v && onMeasureChange!(v)}
        >
          <SelectTrigger size="sm" className="w-[150px]">
            <SelectValue placeholder="Medida" />
          </SelectTrigger>
          <SelectContent>
            {series!.map((s) => (
              <SelectItem key={s.key} value={s.key}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
