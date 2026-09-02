"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ChartKind, ChartSeries } from "./chart-types";

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

const tooltipStyle = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

const axisTick = { fill: "var(--muted-foreground)", fontSize: 12 };

type DatumRecord = Record<string, string | number>;

export interface MultiTypeChartProps {
  data: DatumRecord[];
  nameKey: string;
  series: ChartSeries[];
  kind: ChartKind;
  colorByIndex?: boolean;
  statusColorMap?: Record<string, string>;
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
  statusColorMap?: Record<string, string>
) {
  if (colorByIndex) return CATEGORY_COLORS[index % CATEGORY_COLORS.length];
  return statusColorMap?.[name] ?? fallback ?? CATEGORY_COLORS[0];
}

/** Pie/donut slices always need visually distinct colors — unlike bars, a flat single
 * fallback color would make every slice indistinguishable, so this ignores `colorByIndex`
 * and always cycles the categorical palette (statusColorMap still takes priority). */
function resolvePieColor(name: string, index: number, statusColorMap?: Record<string, string>) {
  return statusColorMap?.[name] ?? CATEGORY_COLORS[index % CATEGORY_COLORS.length];
}

export function MultiTypeChart({
  data,
  nameKey,
  series,
  kind,
  colorByIndex = false,
  statusColorMap,
  pieSeriesKey,
  emptyMessage = "Nenhum dado disponível",
  height = 260,
  valueFormatter = (v) => String(v),
}: MultiTypeChartProps) {
  if (data.length === 0 || series.length === 0) {
    return (
      <div className="flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
        {emptyMessage}
      </div>
    );
  }

  if (kind === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={nameKey}
            tick={axisTick}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: string) => truncateLabel(String(v), 10)}
          />
          <YAxis tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => valueFormatter(Number(value))} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />}
          {series.map((s, i) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              name={s.name}
              stroke={s.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length]}
              strokeWidth={2}
              dot={{ fill: s.color ?? CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (kind === "bar-v" || kind === "bar-h") {
    const isHorizontal = kind === "bar-h";
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={isHorizontal ? "vertical" : "horizontal"} margin={{ left: 8, right: 16 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" horizontal={!isHorizontal} />
          {isHorizontal ? (
            <>
              <XAxis type="number" tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey={nameKey}
                tick={axisTick}
                width={110}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => truncateLabel(v)}
              />
            </>
          ) : (
            <>
              <XAxis
                dataKey={nameKey}
                tick={axisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: string) => truncateLabel(v, 10)}
              />
              <YAxis type="number" tick={axisTick} allowDecimals={false} axisLine={false} tickLine={false} />
            </>
          )}
          <Tooltip
            contentStyle={tooltipStyle}
            formatter={(value) => valueFormatter(Number(value))}
            cursor={{ fill: "var(--muted)" }}
          />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />}
          {series.map((s, si) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.name}
              radius={isHorizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
              maxBarSize={series.length > 1 ? 16 : 22}
              fill={s.color ?? CATEGORY_COLORS[si % CATEGORY_COLORS.length]}
            >
              {series.length === 1 &&
                data.map((entry, i) => (
                  <Cell
                    key={String(entry[nameKey])}
                    fill={resolveColor(String(entry[nameKey]), i, s.color, colorByIndex, statusColorMap)}
                  />
                ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // pie / donut
  const measureKey = series.length > 1 ? (pieSeriesKey ?? series[0].key) : series[0].key;
  const measureSeries = series.find((s) => s.key === measureKey) ?? series[0];
  const pieData = data.map((entry) => ({ name: String(entry[nameKey]), value: Number(entry[measureKey]) || 0 }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value) => [valueFormatter(Number(value)), measureSeries.name]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }} />
        <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={kind === "donut" ? "55%" : 0} outerRadius="80%" paddingAngle={2}>
          {pieData.map((entry, i) => (
            <Cell key={entry.name} fill={resolvePieColor(entry.name, i, statusColorMap)} />
          ))}
        </Pie>
      </PieChart>
    </ResponsiveContainer>
  );
}
