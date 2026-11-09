"use client"

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter"
import { ThemeProvider as MuiThemeProvider } from "@mui/material/styles"
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider"
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns"
import { ptBR } from "date-fns/locale"
import { theme } from "@/theme"

/**
 * MUI root: Emotion cache for the App Router (styles inside `@layer mui`, so Tailwind utilities
 * still win), the theme with light/dark color schemes on the `.dark`/`.light` html class
 * (set before paint by <InitColorSchemeScript /> in app/layout.tsx), and the date pickers' locale.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <AppRouterCacheProvider options={{ key: "mui", enableCssLayer: true }}>
      <MuiThemeProvider theme={theme} defaultMode="system" disableTransitionOnChange>
        <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={ptBR}>
          {children}
        </LocalizationProvider>
      </MuiThemeProvider>
    </AppRouterCacheProvider>
  )
}
