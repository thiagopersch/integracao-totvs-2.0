import type { CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getBadgeTextColor, getContrastTextColor } from "@/lib/colors"

interface ColorBadgeProps {
  label: string
  color: string
  solid?: boolean
}

export function ColorBadge({ label, color, solid = false }: ColorBadgeProps) {
  if (solid) {
    return (
      <Badge style={{ backgroundColor: color, borderColor: color, color: getContrastTextColor(color) }} variant="outline">
        {label}
      </Badge>
    )
  }

  // Both theme variants are computed up front and picked by the `dark` class in CSS — reading the
  // theme in JS (useTheme) is unknown during SSR and made the server/client text color mismatch.
  const style = {
    backgroundColor: `${color}22`,
    borderColor: color,
    "--badge-fg": getBadgeTextColor(color, false),
    "--badge-fg-dark": getBadgeTextColor(color, true),
  } as CSSProperties

  return (
    <Badge style={style} variant="outline" className={cn("text-(--badge-fg) dark:text-(--badge-fg-dark)")}>
      {label}
    </Badge>
  )
}
