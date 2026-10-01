export function getContrastTextColor(hexColor: string): string {
  const hex = hexColor.replace("#", "")
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? "#1f2937" : "#ffffff"
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
