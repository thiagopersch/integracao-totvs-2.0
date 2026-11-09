"use client"

import * as React from "react"
import MuiTabs from "@mui/material/Tabs"
import MuiTab from "@mui/material/Tab"

import { cn } from "@/lib/utils"

type TabValue = string | number | null
type TabsCtx = { value: TabValue; setValue: (value: TabValue) => void; orientation: "horizontal" | "vertical" }
const TabsContext = React.createContext<TabsCtx | null>(null)
function useTabs() {
  const ctx = React.useContext(TabsContext)
  if (!ctx) throw new Error("Tabs parts must be used inside <Tabs>")
  return ctx
}

function Tabs({
  className,
  orientation = "horizontal",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue" | "onChange"> & {
  orientation?: "horizontal" | "vertical"
  value?: TabValue
  defaultValue?: TabValue
  onValueChange?: (value: never) => void
}) {
  const [inner, setInner] = React.useState<TabValue>(defaultValue ?? null)
  const current = value !== undefined ? value : inner
  const ctx = React.useMemo<TabsCtx>(
    () => ({
      value: current,
      setValue: (next) => {
        if (value === undefined) setInner(next)
        ;(onValueChange as ((v: TabValue) => void) | undefined)?.(next)
      },
      orientation,
    }),
    [current, value, onValueChange, orientation]
  )
  return (
    <TabsContext.Provider value={ctx}>
      <div
        data-slot="tabs"
        data-orientation={orientation}
        className={cn("group/tabs flex gap-2", orientation === "horizontal" ? "flex-col" : "flex-row", className)}
        {...props}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

type TabsListProps = {
  className?: string
  children?: React.ReactNode
  variant?: "default" | "line"
  /** Scrolls sideways with ‹ › buttons when the tabs outgrow the width. */
  scrollable?: boolean
}

function TabsList({ className, children, variant = "default", scrollable = true }: TabsListProps) {
  const ctx = useTabs()
  // MUI Tabs warns when `value` matches no Tab; `false` means "no selection".
  const values = React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child) => (child.props as { value?: TabValue }).value)
  const selected = values.includes(ctx.value) ? ctx.value : false
  return (
    <MuiTabs
      data-slot="tabs-list"
      data-variant={variant}
      value={selected}
      onChange={(_event, next) => ctx.setValue(next)}
      orientation={ctx.orientation}
      variant={scrollable ? "scrollable" : "standard"}
      scrollButtons="auto"
      allowScrollButtonsMobile
      className={cn("min-h-9 max-w-full", className)}
      sx={{ borderBottom: ctx.orientation === "horizontal" ? 1 : 0, borderColor: "divider", "& .MuiTabs-scrollButtons.Mui-disabled": { opacity: 0.3 } }}
    >
      {children}
    </MuiTabs>
  )
}

/** Kept for the old API: every TabsList now scrolls with ‹ › buttons when it overflows. */
function ScrollableTabsList(props: TabsListProps) {
  return <TabsList {...props} scrollable />
}

function TabsTrigger({
  className,
  value,
  children,
  disabled,
  ...props
}: Omit<React.ComponentProps<typeof MuiTab>, "value" | "label" | "children"> & { value: TabValue; children?: React.ReactNode }) {
  return (
    <MuiTab
      data-slot="tabs-trigger"
      value={value}
      disabled={disabled}
      label={<span className="inline-flex items-center gap-1.5 [&_svg:not([class*='size-'])]:size-4">{children}</span>}
      className={cn("min-h-9 px-3 py-1.5 text-sm normal-case", className)}
      {...props}
    />
  )
}

function TabsContent({
  className,
  value,
  keepMounted = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { value: TabValue; keepMounted?: boolean }) {
  const ctx = useTabs()
  const active = ctx.value === value
  if (!active && !keepMounted) return null
  return (
    <div role="tabpanel" data-slot="tabs-content" hidden={!active} className={cn("flex-1 text-sm outline-none", className)} {...props}>
      {children}
    </div>
  )
}

const tabsListVariants = () => ""

export { ScrollableTabsList, Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants }
