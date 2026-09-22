import { Badge } from "@/components/ui/badge"
import { getContrastTextColor } from "@/lib/colors"

interface ColorBadgeProps {
  label: string
  color: string
  solid?: boolean
}

export function ColorBadge({ label, color, solid = false }: ColorBadgeProps) {
  const style = solid
    ? { backgroundColor: color, borderColor: color, color: getContrastTextColor(color) }
    : { backgroundColor: `${color}22`, borderColor: color, color }

  return (
    <Badge style={style} variant="outline">
      {label}
    </Badge>
  )
}
