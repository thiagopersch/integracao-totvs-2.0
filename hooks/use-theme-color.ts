"use client";

import { useCallback, useSyncExternalStore } from "react";
import { DEFAULT_THEME_COLOR, THEME_COLOR_STORAGE_KEY, isThemeColorKey, type ThemeColorKey } from "@/constants/theme-colors";

const listeners = new Set<() => void>();

function read(): ThemeColorKey {
  const value = document.documentElement.getAttribute("data-theme-color");
  return isThemeColorKey(value) ? value : DEFAULT_THEME_COLOR;
}

/** Paints `color` on <html> and remembers it for the pre-paint script on the next load. */
export function applyThemeColor(color: ThemeColorKey) {
  if (color === DEFAULT_THEME_COLOR) document.documentElement.removeAttribute("data-theme-color");
  else document.documentElement.setAttribute("data-theme-color", color);
  try {
    localStorage.setItem(THEME_COLOR_STORAGE_KEY, color);
  } catch {
    // Storage blocked (private mode etc.): the color still applies for this page view.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The primary color currently painted, and a setter (visual only — persisting is the caller's job). */
export function useThemeColor() {
  const themeColor = useSyncExternalStore(subscribe, read, () => DEFAULT_THEME_COLOR);
  const setThemeColor = useCallback((color: ThemeColorKey) => applyThemeColor(color), []);
  return { themeColor, setThemeColor };
}
