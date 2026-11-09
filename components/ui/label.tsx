import * as React from "react"
import FormLabel from "@mui/material/FormLabel"

import { cn } from "@/lib/utils"

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <FormLabel
      data-slot="label"
      className={cn("flex items-center gap-2 text-sm leading-none font-medium text-foreground select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50", className)}
      sx={{ color: "text.primary", "&.Mui-focused": { color: "text.primary" } }}
      {...(props as object)}
    />
  )
}

export { Label }
