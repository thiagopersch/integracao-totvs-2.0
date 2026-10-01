"use client"

import { useTheme } from "next-themes"
import { Badge } from "@/components/ui/badge"
import { getBadgeTextColor, getContrastTextColor } from "@/lib/colors"

interface ColorBadgeProps {
  label: string
  color: string
  solid?: boolean
}

export function ColorBadge({ label, color, solid = false }: ColorBadgeProps) {
  const { resolvedTheme } = useTheme()
  const style = solid
    ? { backgroundColor: color, borderColor: color, color: getContrastTextColor(color) }
    : { backgroundColor: `${color}22`, borderColor: color, color: getBadgeTextColor(color, resolvedTheme === "dark") }

  return (
    <Badge style={style} variant="outline">
      {label}
    </Badge>
  )
}
