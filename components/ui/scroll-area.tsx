import * as React from "react"

import { cn } from "@/lib/utils"

/** Scrollable region with the theme's thin scrollbar (MUI has no ScrollArea primitive). */
function ScrollArea({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div data-slot="scroll-area" className={cn("relative overflow-auto [scrollbar-width:thin] [scrollbar-color:var(--border)_transparent]", className)} {...props}>
      {children}
    </div>
  )
}

function ScrollBar(_props: { className?: string; orientation?: "vertical" | "horizontal" }) {
  return null
}

export { ScrollArea, ScrollBar }
