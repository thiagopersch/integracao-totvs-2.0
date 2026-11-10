"use client";

import { BarChart } from "@mui/x-charts/BarChart";
import { LineChart } from "@mui/x-charts/LineChart";
import { PieChart } from "@mui/x-charts/PieChart";
import { shadeColor } from "@/lib/colors";
import type { ChartKind, ChartSeries } from "./chart-types";
import { useMediaQuery } from "@/hooks/use-media-query";

/** Fixed categorical order (blue, orange, aqua, yellow, magenta, green, violet, red) — never reassigned by rank. */
const CATEGORY_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

const axisSx = {
  "& .MuiChartsAxis-tickLabel": { fill: "var(--muted-foreground)", fontSize: 12 },
  "& .MuiChartsAxis-line, & .MuiChartsAxis-tick": { display: "none" },
  "& .MuiChartsGrid-line": { stroke: "var(--border)", strokeDasharray: "3 3" },
} as const;

type DatumRecord = Record<string, string | number>;

export interface MultiTypeChartProps {
  data: DatumRecord[];
  nameKey: string;
  series: ChartSeries[];
  kind: ChartKind;
  colorByIndex?: boolean;
  statusColorMap?: Record<string, string>;
  /** Field in `data` holding a per-row hex color (e.g. the client's registered color).
   * Takes priority over `colorByIndex`/`series.color`; multi-series bars shade progressively
   * darker per series index so comparisons stay tied to that row's identity color. */
  colorKey?: string;
  /** Which series pie/donut encodes when there's more than one (ignored otherwise). */
  pieSeriesKey?: string;
  emptyMessage?: string;
  height?: number;
  valueFormatter?: (value: number) => string;
}

function truncateLabel(value: string, max = 16) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function resolveColor(
  name: string,
  index: number,
  fallback: string | undefined,
  colorByIndex: boolean,
  statusColorMap?: Record<string, string>,
  rowColor?: string
) {
  if (rowColor) return rowColor;
  if (colorByIndex) return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  return statusColorMap?.[name] ?? fallback ?? CATEGORY_COLORS[0];
}

/** Pie/donut slices always need visually distinct colors — unlike bars, a flat single
 * fallback color would make every slice indistinguishable, so this ignores `colorByIndex`
 * and always cycles the categorical palette (statusColorMap and a per-row `colorKey` color
 * still take priority). */
function resolvePieColor(name: string, index: number, statusColorMap?: Record<string, string>, rowColor?: string) {
  return rowColor || statusColorMap?.[name] || CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function MultiTypeChart({
  data,
  nameKey,
  series,
  kind,
  colorByIndex = false,
  statusColorMap,
  colorKey,
  pieSeriesKey,
  emptyMessage = "Nenhum dado disponível",
  height = 260,
  valueFormatter = (v) => String(v),
}: MultiTypeChartProps) {
  // Narrower category axis on phones so horizontal bars keep room to render.
  const narrow = useMediaQuery("(max-width: 639px)");
  if (data.length === 0 || series.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  const categories = data.map((entry) => String(entry[nameKey]));
  const formatValue = (value: number | null) => (value == null ? "" : valueFormatter(Number(value)));
  const hideLegend = series.length <= 1;

  if (kind === "line") {
    return (
      <LineChart
        height={height}
        grid={{ horizontal: true }}
        sx={axisSx}
        hideLegend={hideLegend}
        xAxis={[{ scaleType: "point", data: categories, valueFormatter: (v: string) => truncateLabel(String(v), 10) }]}
        yAxis={[{ tickMinStep: 1 }]}
        series={series.map((s, i) => ({
          id: s.key,
          label: s.name,
          data: data.map((entry) => Number(entry[s.key]) || 0),
          color: s.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length],
          curve: "monotoneX",
          valueFormatter: formatValue,
        }))}
      />
    );
  }

  if (kind === "bar-v" || kind === "bar-h") {
    const isHorizontal = kind === "bar-h";
    const bandAxis = {
      scaleType: "band" as const,
      data: categories,
      valueFormatter: (v: string, ctx: { location: string }) => (ctx.location === "tick" ? truncateLabel(String(v), isHorizontal ? 16 : 10) : String(v)),
      categoryGapRatio: 0.35,
    };
    const valueAxis = { tickMinStep: 1 };
    return (
      <BarChart
        height={height}
        layout={isHorizontal ? "horizontal" : "vertical"}
        grid={isHorizontal ? { vertical: true } : { horizontal: true }}
        borderRadius={4}
        sx={axisSx}
        hideLegend={hideLegend}
        xAxis={isHorizontal ? [valueAxis] : [bandAxis]}
        yAxis={isHorizontal ? [{ ...bandAxis, width: narrow ? 72 : 110 }] : [valueAxis]}
        margin={{ left: 8, right: 16 }}
        series={series.map((s, si) => ({
          id: s.key,
          label: s.name,
          data: data.map((entry) => Number(entry[s.key]) || 0),
          color: s.color ?? CATEGORY_COLORS[si % CATEGORY_COLORS.length],
          valueFormatter: formatValue,
          // Per-bar colors: a row's own color (shaded per series), the category palette, or a status map.
          ...(series.length === 1 || colorKey
            ? {
                colorGetter: ({ dataIndex }: { dataIndex: number }) => {
                  const entry = data[dataIndex];
                  const rowColor = colorKey && entry?.[colorKey] ? shadeColor(String(entry[colorKey]), si === 0 ? 0 : -18 * si) : undefined;
                  return resolveColor(categories[dataIndex] ?? "", dataIndex, s.color, colorByIndex, statusColorMap, rowColor);
                },
              }
            : {}),
        }))}
      />
    );
  }

  // pie / donut
  const measureKey = series.length > 1 ? (pieSeriesKey ?? series[0].key) : series[0].key;
  const pieData = data.map((entry, i) => {
    const name = String(entry[nameKey]);
    const rowColor = colorKey && entry[colorKey] ? String(entry[colorKey]) : undefined;
    return { id: `${name}-${i}`, label: name, value: Number(entry[measureKey]) || 0, color: resolvePieColor(name, i, statusColorMap, rowColor) };
  });

  return (
    <PieChart
      height={height}
      series={[
        {
          data: pieData,
          innerRadius: kind === "donut" ? "55%" : 0,
          outerRadius: "80%",
          paddingAngle: 2,
          cornerRadius: 3,
          valueFormatter: (item) => valueFormatter(Number(item.value)),
        },
      ]}
      slotProps={{ legend: { sx: { fontSize: 12, color: "var(--muted-foreground)" } } }}
    />
  );
}
