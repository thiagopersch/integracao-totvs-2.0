"use client"

import { useTransition } from "react"
import { useSession } from "next-auth/react"
import { toast } from "@/lib/toast"
import { useAppTheme } from "@/hooks/use-app-theme"
import { useThemeColor } from "@/hooks/use-theme-color"
import { updateThemeColorAction } from "@/actions/auth/profile"
import { Field, FieldLabel } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  THEME_COLOR_KEYS,
  THEME_COLOR_LABELS,
  THEME_COLOR_PALETTES,
  isThemeColorKey,
  type ThemeColorKey,
} from "@/constants/theme-colors"

/**
 * Primary-color select for the profile (swatch + name per option). Applies the color at once
 * (optimistic), saves it on the user, and refreshes the session token so other tabs/devices get it.
 */
export function ThemeColorPicker() {
  const { themeColor, setThemeColor } = useThemeColor()
  const { resolvedTheme } = useAppTheme()
  const { update } = useSession()
  const [pending, startTransition] = useTransition()
  const scheme = resolvedTheme === "dark" ? "dark" : "light"

  const option = (key: ThemeColorKey) => (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="size-4 shrink-0 rounded-full"
        style={{ backgroundColor: THEME_COLOR_PALETTES[key][scheme].main }}
      />
      {THEME_COLOR_LABELS[key]}
    </span>
  )
  const items = THEME_COLOR_KEYS.map((key) => ({ value: key, label: option(key) }))

  function choose(color: string | null) {
    if (!isThemeColorKey(color) || color === themeColor) return
    const previous = themeColor
    setThemeColor(color)
    startTransition(async () => {
      const result = await updateThemeColorAction(color)
      if (result.success) {
        await update()
        toast.success(`Cor do tema: ${THEME_COLOR_LABELS[color]}`)
      } else {
        setThemeColor(previous)
        toast.error(result.error || "Erro ao salvar a cor do tema")
      }
    })
  }

  return (
    <Field>
      <FieldLabel>Cor do tema</FieldLabel>
      <Select items={items} value={themeColor} onValueChange={choose} disabled={pending}>
        <SelectTrigger className="w-full sm:w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {THEME_COLOR_KEYS.map((key) => (
            <SelectItem key={key} value={key}>
              {option(key)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  )
}
