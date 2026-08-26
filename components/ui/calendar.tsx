"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { DayPicker, type DayButtonProps } from "react-day-picker"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      captionLayout={captionLayout}
      className={cn("p-2", className)}
      classNames={{
        root: "w-fit",
        months: "flex gap-4 flex-col sm:flex-row relative",
        month: "flex flex-col w-full gap-3",
        nav: "flex items-center gap-1 w-full absolute top-0 inset-x-0 justify-between z-10",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-7 aria-disabled:opacity-50"
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "size-7 aria-disabled:opacity-50"
        ),
        month_caption: "flex items-center justify-center h-8 w-full px-8 text-sm font-medium",
        weekdays: "flex",
        weekday: "text-muted-foreground flex-1 font-normal text-[0.8rem] select-none",
        week: "flex w-full mt-1",
        day: "relative w-8 h-8 p-0 text-center text-sm focus-within:relative focus-within:z-20",
        range_start: "rounded-l-md",
        range_middle: "rounded-none",
        range_end: "rounded-r-md",
        outside: "text-muted-foreground opacity-50",
        disabled: "text-muted-foreground opacity-50",
        hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ className, orientation, ...props }) => {
          const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon
          return <Icon className={cn("size-4", className)} {...props} />
        },
        DayButton: CalendarDayButton,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({ className, day, modifiers, ...props }: DayButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <button
      ref={ref}
      data-selected={modifiers.selected}
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        buttonVariants({ variant: "ghost" }),
        "size-8 rounded-md p-0 font-normal",
        modifiers.today && "bg-accent text-accent-foreground",
        (modifiers.selected || modifiers.range_start || modifiers.range_end) &&
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        modifiers.range_middle && "bg-accent text-accent-foreground",
        className
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
