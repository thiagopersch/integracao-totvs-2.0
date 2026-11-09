import * as React from "react"
import Divider from "@mui/material/Divider"

import { cn } from "@/lib/utils"

function Separator({ className, orientation = "horizontal" }: { className?: string; orientation?: "horizontal" | "vertical"; decorative?: boolean }) {
  return <Divider data-slot="separator" orientation={orientation} flexItem={orientation === "vertical"} className={cn("shrink-0", className)} />
}

export { Separator }
