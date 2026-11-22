import type { CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { getBadgeTextColor, getContrastTextColor } from "@/lib/colors"

interface ColorBadgeProps {
  label: string
  color: string
  solid?: boolean
  /** Extra classes (e.g. `max-w-full` so a long label ellipsizes inside a narrow cell). */
  className?: string
  /** Native tooltip; useful with a truncated label. */
  title?: string
}

export function ColorBadge({ label, color, solid = false, className, title }: ColorBadgeProps) {
  if (solid) {
    return (
      <Badge
        style={{ backgroundColor: color, borderColor: color, color: getContrastTextColor(color) }}
        variant="outline"
        className={className}
        title={title}
      >
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
    <Badge style={style} variant="outline" className={cn("text-(--badge-fg) dark:text-(--badge-fg-dark)", className)} title={title}>
      {label}
    </Badge>
  )
}
