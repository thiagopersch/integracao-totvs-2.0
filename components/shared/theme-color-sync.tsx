"use client"

import { useEffect } from "react"
import { applyThemeColor } from "@/hooks/use-theme-color"
import { DEFAULT_THEME_COLOR, isThemeColorKey } from "@/constants/theme-colors"

/**
 * Brings the color saved on the user's profile to this browser: on a new device, after clearing
 * site data, or after another user signed in here. From then on the pre-paint script keeps it.
 */
export function ThemeColorSync({ themeColor }: { themeColor: string | null | undefined }) {
  useEffect(() => {
    const saved = isThemeColorKey(themeColor) ? themeColor : DEFAULT_THEME_COLOR
    const painted = document.documentElement.getAttribute("data-theme-color") ?? DEFAULT_THEME_COLOR
    if (saved !== painted) applyThemeColor(saved)
  }, [themeColor])
  return null
}
