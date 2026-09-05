import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { getWeekdayName } from "@/utils/format"

interface DateCellProps {
  date: Date | string
  /** Rendered text (already formatted by the caller, e.g. via `formatDateOnly`). */
  children: React.ReactNode
  /** Pass "UTC" for date-only values (see `formatDateOnly`) — defaults to the app's display timezone. */
  timeZone?: string
  className?: string
}

/** Wraps a formatted date cell value with a tooltip showing the full weekday name on hover. */
export function DateCell({ date, children, timeZone, className }: DateCellProps) {
  const weekday = getWeekdayName(date, timeZone)
  return (
    <Tooltip>
      <TooltipTrigger render={<span className={className}>{children}</span>} />
      <TooltipContent>{weekday.charAt(0).toUpperCase() + weekday.slice(1)}</TooltipContent>
    </Tooltip>
  )
}
