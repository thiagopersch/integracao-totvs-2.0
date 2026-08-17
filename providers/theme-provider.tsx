"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"
import { TooltipProvider } from "@/components/ui/tooltip"

export function ThemeProvider({ children, ...props }: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}><TooltipProvider>{children}</TooltipProvider></NextThemesProvider>
}
