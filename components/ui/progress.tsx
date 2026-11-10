"use client"

import * as React from "react"
import LinearProgress from "@mui/material/LinearProgress"

import { cn } from "@/lib/utils"

function Progress({ className, children, value }: { className?: string; children?: React.ReactNode; value?: number | null }) {
  return (
    <div data-slot="progress" className={cn("flex flex-wrap gap-3", className)}>
      {children}
      <LinearProgress
        data-slot="progress-track"
        variant={value == null ? "indeterminate" : "determinate"}
        value={value ?? undefined}
        className="w-full"
      />
    </div>
  )
}

function ProgressTrack({ className, children }: { className?: string; children?: React.ReactNode }) {
  return <div className={cn("relative h-1 w-full overflow-hidden rounded-full bg-primary/16", className)}>{children}</div>
}

function ProgressIndicator({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div className={cn("h-full bg-primary transition-all", className)} style={style} />
}

function ProgressLabel({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="progress-label" className={cn("text-sm font-medium", className)} {...props} />
}

function ProgressValue({ className, ...props }: React.ComponentProps<"span">) {
  return <span data-slot="progress-value" className={cn("ml-auto text-sm text-muted-foreground tabular-nums", className)} {...props} />
}

export { Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue }
