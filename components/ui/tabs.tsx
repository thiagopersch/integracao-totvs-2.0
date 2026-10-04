"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Tabs as TabsPrimitive } from "@base-ui/react/tabs"
import { cva, type VariantProps } from "class-variance-authority"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-lg p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        // On narrow screens the list scrolls sideways (scrollbar hidden) instead of overflowing the page.
        default:
          "bg-muted max-w-full justify-start overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      {...props}
    />
  )
}

/** Single-row tab list that never wraps: when the tabs outgrow the width it scrolls sideways and
 *  shows ‹ › buttons on both sides (disabled at each edge), like Material's mat-tab pagination.
 *  Without overflow it renders just like `TabsList`. The clicked/focused tab is scrolled into view. */
function ScrollableTabsList({
  className,
  ...props
}: Omit<TabsPrimitive.List.Props, "ref"> & VariantProps<typeof tabsListVariants>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState({ overflowing: false, canLeft: false, canRight: false })

  const update = useCallback(() => {
    const list = listRef.current
    if (!list) return
    const { scrollLeft, scrollWidth, clientWidth } = list
    const next = {
      overflowing: scrollWidth > clientWidth + 1,
      canLeft: scrollLeft > 1,
      canRight: scrollLeft + clientWidth < scrollWidth - 1,
    }
    setScroll((prev) =>
      prev.overflowing === next.overflowing && prev.canLeft === next.canLeft && prev.canRight === next.canRight
        ? prev
        : next
    )
  }, [])

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    update()
    list.addEventListener("scroll", update, { passive: true })
    const observer = new ResizeObserver(update)
    observer.observe(list)
    for (const child of Array.from(list.children)) observer.observe(child)
    return () => {
      list.removeEventListener("scroll", update)
      observer.disconnect()
    }
  }, [update])

  // Tabs added/removed (e.g. another Data Server) change scrollWidth without resizing the list.
  useEffect(update)

  function scrollByPage(direction: 1 | -1) {
    const list = listRef.current
    if (list) list.scrollBy({ left: direction * list.clientWidth * 0.8, behavior: "smooth" })
  }

  function revealTab(target: EventTarget) {
    const tab = (target as HTMLElement).closest?.('[data-slot="tabs-trigger"]')
    tab?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" })
  }

  return (
    <div className="flex w-full max-w-full min-w-0 items-center gap-1">
      {scroll.overflowing && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Tabs anteriores"
          disabled={!scroll.canLeft}
          onClick={() => scrollByPage(-1)}
        >
          <ChevronLeft />
        </Button>
      )}
      <TabsList
        ref={listRef}
        className={cn("min-w-0 flex-1 justify-start [&>[data-slot=tabs-trigger]]:flex-none", className)}
        onClickCapture={(event) => revealTab(event.target)}
        onFocusCapture={(event) => revealTab(event.target)}
        {...props}
      />
      {scroll.overflowing && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Próximas tabs"
          disabled={!scroll.canRight}
          onClick={() => scrollByPage(1)}
        >
          <ChevronRight />
        </Button>
      )}
    </div>
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-disabled:pointer-events-none aria-disabled:cursor-not-allowed aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-sm group-data-[variant=line]/tabs-list:data-active:shadow-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none [&[inert]]:hidden", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, ScrollableTabsList, TabsTrigger, TabsContent, tabsListVariants }
