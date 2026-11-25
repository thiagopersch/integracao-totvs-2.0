import { THEME_COLORS_CSS, THEME_COLOR_KEYS, THEME_COLOR_STORAGE_KEY } from "@/constants/theme-colors"

/**
 * The per-user primary color, applied before first paint (same idea as MUI's InitColorSchemeScript):
 * the overriding CSS variables for every color, plus a tiny script that puts the last chosen color
 * (localStorage) on `<html data-theme-color>`. The user's saved color reaches localStorage through
 * <ThemeColorSync /> in the dashboard layout, so a new device picks it up on its first load.
 */
export function InitThemeColorScript() {
  const script = `(function(){try{var c=localStorage.getItem(${JSON.stringify(THEME_COLOR_STORAGE_KEY)});if(c&&c!=="default"&&${JSON.stringify(THEME_COLOR_KEYS)}.indexOf(c)>-1)document.documentElement.setAttribute("data-theme-color",c)}catch(e){}})()`
  return (
    <>
      <style id="theme-colors" dangerouslySetInnerHTML={{ __html: THEME_COLORS_CSS }} />
      <script dangerouslySetInnerHTML={{ __html: script }} />
    </>
  )
}
