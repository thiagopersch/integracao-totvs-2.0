"use client";

import { useColorScheme } from "@mui/material/styles";

/**
 * Same shape the app used from next-themes' `useTheme`, backed by MUI's color scheme:
 * `theme` is the chosen mode ("light" | "dark" | "system"), `resolvedTheme` what is painted.
 * Before hydration MUI reports `undefined` mode; callers already treat that as "light".
 */
export function useAppTheme() {
  const { mode, systemMode, setMode } = useColorScheme();
  const resolvedTheme = mode === "system" ? systemMode : mode;
  return {
    theme: mode,
    resolvedTheme,
    setTheme: (value: "light" | "dark" | "system") => setMode(value),
  };
}
