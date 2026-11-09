"use client"

import * as React from "react"
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar"
import { PickerDay as PickersDay, type PickerDayProps as PickersDayProps } from "@mui/x-date-pickers/PickerDay"
import { addMonths, format, isAfter, isBefore, isSameDay, isWithinInterval, startOfMonth } from "date-fns"
import { CalendarIcon, X } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

/** Same shape react-day-picker used, so callers didn't change. */
export type DateRange = { from: Date | undefined; to?: Date | undefined }

interface DateRangePickerProps {
  value: DateRange | undefined
  onValueChange: (range: DateRange | undefined) => void
  placeholder?: string
  className?: string
  disabled?: boolean
}

type RangeDayProps = PickersDayProps & { range?: DateRange; hover?: Date | null; onHover?: (day: Date | null) => void }

function RangeDay({ range, hover, onHover, day, outsideCurrentMonth, ...other }: RangeDayProps) {
  const from = range?.from
  const to = range?.to ?? (from && hover && isAfter(hover, from) ? hover : undefined)
  const isStart = !!from && isSameDay(day, from)
  const isEnd = !!to && isSameDay(day, to)
  const inRange = !!from && !!to && isWithinInterval(day, { start: from, end: to })
  return (
    <PickersDay
      {...other}
      day={day}
      outsideCurrentMonth={outsideCurrentMonth}
      selected={!outsideCurrentMonth && (isStart || isEnd)}
      onMouseEnter={() => onHover?.(day)}
      sx={
        inRange && !outsideCurrentMonth && !isStart && !isEnd
          ? { borderRadius: 0, bgcolor: "action.selected", "&:hover": { bgcolor: "action.focus" } }
          : undefined
      }
    />
  )
}

/**
 * Date range picker built from two free MUI X `DateCalendar`s (the MUI X DateRangePicker is a
 * paid Pro component). First click sets the start, second the end.
 */
export function DateRangePicker({ value, onValueChange, placeholder = "Selecione um período", className, disabled }: DateRangePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [hover, setHover] = React.useState<Date | null>(null)
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(value?.from ?? new Date()))

  function pick(day: Date | null) {
    if (!day) return
    const from = value?.from
    if (!from || value?.to) {
      onValueChange({ from: day, to: undefined })
    } else if (isBefore(day, from)) {
      onValueChange({ from: day, to: from })
      setOpen(false)
    } else {
      onValueChange({ from, to: day })
      setOpen(false)
    }
  }

  const label = value?.from
    ? value.to
      ? `${format(value.from, "dd/MM/yyyy")} - ${format(value.to, "dd/MM/yyyy")}`
      : format(value.from, "dd/MM/yyyy")
    : placeholder

  const dayProps = { range: value, hover, onHover: setHover } as Partial<RangeDayProps>

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        render={<Button type="button" variant="outline" className={cn("w-full justify-start font-normal", !value?.from && "text-muted-foreground", className)} />}
      >
        <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{label}</span>
        {value?.from && !disabled && (
          <span
            role="button"
            tabIndex={0}
            aria-label="Limpar período"
            className="-mr-1 ml-2 shrink-0 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              onValueChange(undefined)
            }}
          >
            <X className="h-3.5 w-3.5" />
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col sm:flex-row" onMouseLeave={() => setHover(null)}>
          {[0, 1].map((offset) => (
            <DateCalendar
              key={offset}
              value={null}
              referenceDate={addMonths(month, offset)}
              onChange={pick}
              onMonthChange={(m) => setMonth(addMonths(m, -offset))}
              slots={{ day: RangeDay as React.ComponentType<PickersDayProps> }}
              slotProps={{ day: dayProps as PickersDayProps }}
              className={cn(offset === 1 && "max-sm:hidden")}
              sx={{ width: 296, height: "auto", "& .MuiDayCalendar-slideTransition": { minHeight: 220 } }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
