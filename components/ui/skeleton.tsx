import * as React from "react"
import MuiSkeleton from "@mui/material/Skeleton"

import { cn } from "@/lib/utils"

/** MUI Skeleton sized by Tailwind classes (`h-4 w-32`, `rounded-full`, …), like the old shadcn one. */
function Skeleton({ className, variant = "rounded", style, children }: { className?: string; variant?: "rounded" | "text" | "circular" | "rectangular"; style?: React.CSSProperties; children?: React.ReactNode }) {
  return (
    <MuiSkeleton data-slot="skeleton" variant={variant} animation="wave" className={cn("transform-none", className)} style={style} sx={{ transform: "none" }}>
      {children}
    </MuiSkeleton>
  )
}

export { Skeleton }
