/**
 * Per-user primary ("theme") color. The whole app paints its primary color from MUI's
 * `--mui-palette-primary-*` CSS variables (Tailwind's `--primary`, `--ring`, `--accent`… point at
 * them in app/globals.css), so a color is applied by overriding those variables on
 * `<html data-theme-color="…">` — see THEME_COLORS_CSS, injected in app/layout.tsx.
 *
 * Palettes are the Tailwind v4 colors shadcn/ui uses (https://ui.shadcn.com/colors), as hex
 * because MUI needs RGB channels (`mainChannel`) for its translucent tints.
 */

type Shades = { 300: string; 400: string; 500: string; 700: string; 800: string; 900: string; 950: string }

const TAILWIND: Record<string, Shades> = {
  neutral: { 300: "#d4d4d4", 400: "#a1a1a1", 500: "#737373", 700: "#404040", 800: "#262626", 900: "#171717", 950: "#0a0a0a" },
  amber: { 300: "#ffd230", 400: "#ffb900", 500: "#fe9a00", 700: "#bb4d00", 800: "#973c00", 900: "#7b3306", 950: "#461901" },
  blue: { 300: "#8ec5ff", 400: "#51a2ff", 500: "#2b7fff", 700: "#1447e6", 800: "#193cb8", 900: "#1c398e", 950: "#162456" },
  cyan: { 300: "#53eafd", 400: "#00d3f2", 500: "#00b8db", 700: "#007595", 800: "#005f78", 900: "#104e64", 950: "#053345" },
  emerald: { 300: "#5ee9b5", 400: "#00d492", 500: "#00bc7d", 700: "#007a55", 800: "#006045", 900: "#004f3b", 950: "#002c22" },
  fuchsia: { 300: "#f4a8ff", 400: "#ed6aff", 500: "#e12afb", 700: "#a800b7", 800: "#8a0194", 900: "#721378", 950: "#4b004f" },
  green: { 300: "#7bf1a8", 400: "#05df72", 500: "#00c950", 700: "#008236", 800: "#016630", 900: "#0d542b", 950: "#032e15" },
  indigo: { 300: "#a3b3ff", 400: "#7c86ff", 500: "#615fff", 700: "#432dd7", 800: "#372aac", 900: "#312c85", 950: "#1e1a4d" },
  lime: { 300: "#bbf451", 400: "#9ae600", 500: "#7ccf00", 700: "#497d00", 800: "#3c6300", 900: "#35530e", 950: "#192e03" },
  orange: { 300: "#ffb86a", 400: "#ff8904", 500: "#ff6900", 700: "#ca3500", 800: "#9f2d00", 900: "#7e2a0c", 950: "#441306" },
  pink: { 300: "#fda5d5", 400: "#fb64b6", 500: "#f6339a", 700: "#c6005c", 800: "#a3004c", 900: "#861043", 950: "#510424" },
  purple: { 300: "#dab2ff", 400: "#c27aff", 500: "#ad46ff", 700: "#8200db", 800: "#6e11b0", 900: "#59168b", 950: "#3c0366" },
  red: { 300: "#ffa2a2", 400: "#ff6467", 500: "#fb2c36", 700: "#c10007", 800: "#9f0712", 900: "#82181a", 950: "#460809" },
  rose: { 300: "#ffa1ad", 400: "#ff637e", 500: "#ff2056", 700: "#c70036", 800: "#a50036", 900: "#8b0836", 950: "#4d0218" },
  sky: { 300: "#74d4ff", 400: "#00bcff", 500: "#00a6f4", 700: "#0069a8", 800: "#00598a", 900: "#024a70", 950: "#052f4a" },
  teal: { 300: "#46ecd5", 400: "#00d5be", 500: "#00bba7", 700: "#00786f", 800: "#005f5a", 900: "#0b4f4a", 950: "#022f2e" },
  violet: { 300: "#c4b4ff", 400: "#a684ff", 500: "#8e51ff", 700: "#7008e7", 800: "#5d0ec0", 900: "#4d179a", 950: "#2f0d68" },
  yellow: { 300: "#ffdf20", 400: "#fdc700", 500: "#f0b100", 700: "#a65f00", 800: "#894b00", 900: "#733e0a", 950: "#432004" },
}

export const THEME_COLOR_KEYS = [
  "default",
  "neutral",
  "amber",
  "blue",
  "cyan",
  "emerald",
  "fuchsia",
  "green",
  "indigo",
  "lime",
  "orange",
  "pink",
  "purple",
  "red",
  "rose",
  "sky",
  "teal",
  "violet",
  "yellow",
] as const

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number]

export const DEFAULT_THEME_COLOR: ThemeColorKey = "default"
/** localStorage key read before paint by the inline script in app/layout.tsx. */
export const THEME_COLOR_STORAGE_KEY = "theme-color"

export const THEME_COLOR_LABELS: Record<ThemeColorKey, string> = {
  default: "Padrão",
  neutral: "Neutro",
  amber: "Âmbar",
  blue: "Azul",
  cyan: "Ciano",
  emerald: "Esmeralda",
  fuchsia: "Fúcsia",
  green: "Verde",
  indigo: "Índigo",
  lime: "Lima",
  orange: "Laranja",
  pink: "Rosa",
  purple: "Roxo",
  red: "Vermelho",
  rose: "Rosé",
  sky: "Céu",
  teal: "Verde-azulado",
  violet: "Violeta",
  yellow: "Amarelo",
}

export function isThemeColorKey(value: unknown): value is ThemeColorKey {
  return typeof value === "string" && (THEME_COLOR_KEYS as readonly string[]).includes(value)
}

type PrimaryPalette = { main: string; light: string; dark: string; contrastText: string }
type SchemePalettes = { light: PrimaryPalette; dark: PrimaryPalette }

/** Same values as `theme/index.ts` (brand green) — kept here for the swatch preview only. */
const DEFAULT_PALETTES: SchemePalettes = {
  light: { main: "#008236", light: "#3fa864", dark: "#005c26", contrastText: "#ffffff" },
  dark: { main: "#66d18f", light: "#8fe0ad", dark: "#3fa864", contrastText: "#00391a" },
}

function palettesFor(key: Exclude<ThemeColorKey, "default">): SchemePalettes {
  const c = TAILWIND[key]
  if (key === "neutral") {
    return {
      light: { main: c[900], light: c[700], dark: c[950], contrastText: "#ffffff" },
      dark: { main: "#e5e5e5", light: "#f5f5f5", dark: c[300], contrastText: c[900] },
    }
  }
  return {
    light: { main: c[700], light: c[500], dark: c[800], contrastText: "#ffffff" },
    dark: { main: c[400], light: c[300], dark: c[500], contrastText: c[950] },
  }
}

export const THEME_COLOR_PALETTES: Record<ThemeColorKey, SchemePalettes> = Object.fromEntries(
  THEME_COLOR_KEYS.map((key) => [key, key === "default" ? DEFAULT_PALETTES : palettesFor(key)]),
) as Record<ThemeColorKey, SchemePalettes>

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
const channel = (hex: string) => rgb(hex).join(" ")
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")
/** MUI's lighten/darken (createThemeWithVars derives a few component tokens from primary with them). */
const lighten = (hex: string, k: number) => toHex(rgb(hex).map((v) => v + (255 - v) * k))
const darken = (hex: string, k: number) => toHex(rgb(hex).map((v) => v * (1 - k)))

function vars(p: PrimaryPalette, scheme: "light" | "dark") {
  const derived =
    scheme === "light"
      ? { track: lighten(p.main, 0.62), switchDisabled: lighten(p.main, 0.62) }
      : { track: darken(p.main, 0.5), switchDisabled: darken(p.main, 0.55) }
  return [
    `--mui-palette-primary-main:${p.main}`,
    `--mui-palette-primary-light:${p.light}`,
    `--mui-palette-primary-dark:${p.dark}`,
    `--mui-palette-primary-contrastText:${p.contrastText}`,
    `--mui-palette-primary-mainChannel:${channel(p.main)}`,
    `--mui-palette-primary-lightChannel:${channel(p.light)}`,
    `--mui-palette-primary-darkChannel:${channel(p.dark)}`,
    `--mui-palette-primary-contrastTextChannel:${channel(p.contrastText)}`,
    `--mui-palette-LinearProgress-primaryBg:${derived.track}`,
    `--mui-palette-Slider-primaryTrack:${derived.track}`,
    `--mui-palette-Switch-primaryDisabledColor:${derived.switchDisabled}`,
  ].join(";")
}

/**
 * Overrides for every non-default color. `html[data-theme-color]` / `html.dark[data-theme-color]`
 * out-rank MUI's `:root` / `.dark` variable blocks, so no `!important` is needed.
 */
export const THEME_COLORS_CSS = THEME_COLOR_KEYS.filter((k) => k !== "default")
  .map((key) => {
    const p = THEME_COLOR_PALETTES[key]
    return `html[data-theme-color="${key}"]{${vars(p.light, "light")}}html.dark[data-theme-color="${key}"]{${vars(p.dark, "dark")}}`
  })
  .join("")
