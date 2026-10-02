import { USAGE_LEVEL_COLORS, formatHours, type UsageLevel } from "@/lib/contract-usage"
import { cn } from "@/lib/utils"

interface ContractUsageBarProps {
  usedHours: number
  contractedHours: number
  percent: number
  level: UsageLevel
  className?: string
}

/** Monthly contract consumption: "42,5h / 50h · 85%" over a bar tinted by usage level
 *  (green → yellow at 80% → orange at 90% → red at 100%). */
export function ContractUsageBar({ usedHours, contractedHours, percent, level, className }: ContractUsageBarProps) {
  const color = USAGE_LEVEL_COLORS[level]
  return (
    <div className={cn("flex min-w-36 flex-col gap-1", className)}>
      <div className="flex items-baseline justify-between gap-2 text-xs tabular-nums">
        <span className="text-muted-foreground">
          {formatHours(usedHours)} / {formatHours(contractedHours)}
        </span>
        <span className="font-semibold" style={{ color: level === "ok" ? undefined : color }}>
          {percent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
