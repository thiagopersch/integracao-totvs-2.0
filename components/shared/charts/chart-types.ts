export type ChartKind = "line" | "bar-v" | "bar-h" | "pie" | "donut";

export interface ChartSeries {
  key: string;
  name: string;
  color?: string;
  /** When true, this series always uses `color` as-is — ignores colorKey/colorByIndex/statusColorMap.
   *  For series with a fixed meaning (e.g. "excedente" always red), regardless of per-row coloring. */
  fixedColor?: boolean;
}

export const ALL_CHART_KINDS: ChartKind[] = ["line", "bar-v", "bar-h", "pie", "donut"];

export const CHART_KIND_LABELS: Record<ChartKind, string> = {
  line: "Linha",
  "bar-v": "Barra Vertical",
  "bar-h": "Barra Horizontal",
  pie: "Pizza",
  donut: "Rosca",
};
