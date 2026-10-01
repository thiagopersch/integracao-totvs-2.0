function getLuminance(hexColor: string): number {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function getContrastTextColor(hexColor: string): string {
  return getLuminance(hexColor) > 0.6 ? "#1f2937" : "#ffffff"
}

/**
 * Text color for a tinted badge (background = `color` at ~13% alpha). Keeps the registered
 * color's hue but shades it darker/lighter when the color+theme combo would be low-contrast:
 * a light color on the light theme, or a dark color on the dark theme — both leave the tinted
 * background close to the page background, making raw-color text hard to read.
 */
export function getBadgeTextColor(hexColor: string, isDarkTheme: boolean): string {
  const isLightColor = getLuminance(hexColor) > 0.6
  if (!isDarkTheme && isLightColor) return shadeColor(hexColor, -40)
  if (isDarkTheme && !isLightColor) return shadeColor(hexColor, 40)
  return hexColor
}

/** Lightens (positive) or darkens (negative) a `#rrggbb` color by a percentage. */
export function shadeColor(hexColor: string, percent: number): string {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  const adjust = (channel: number) => {
    const adjusted = percent < 0 ? channel * (1 + percent / 100) : channel + (255 - channel) * (percent / 100)
    return Math.max(0, Math.min(255, Math.round(adjusted)))
  }

  const toHex = (channel: number) => channel.toString(16).padStart(2, "0")
  return `#${toHex(adjust(r))}${toHex(adjust(g))}${toHex(adjust(b))}`
}
