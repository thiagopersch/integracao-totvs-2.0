"use client"

import { useState } from "react"
import { Eye, EyeOff, Check, X } from "lucide-react"
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group"
import { cn } from "@/lib/utils"
import { passwordRequirements } from "@/lib/validators"

type PasswordInputProps = {
  value?: string
  onChange: (value: string) => void
  onBlur?: () => void
  disabled?: boolean
  placeholder?: string
  className?: string
  "aria-invalid"?: boolean
  showStrength?: boolean
}

const requirementList = [
  { key: "hasUppercase", label: "Letra maiúscula", check: (v: string) => passwordRequirements.hasUppercase(v) },
  { key: "hasLowercase", label: "Letra minúscula", check: (v: string) => passwordRequirements.hasLowercase(v) },
  { key: "hasNumber", label: "Número", check: (v: string) => passwordRequirements.hasNumber(v) },
  { key: "hasSpecial", label: "Caractere especial (!@#$%^&*)", check: (v: string) => passwordRequirements.hasSpecial(v) },
  { key: "minLength", label: "Mínimo 8 caracteres", check: (v: string) => v.length >= passwordRequirements.minLength },
  { key: "maxLength", label: "Máximo 32 caracteres", check: (v: string) => v.length > 0 && v.length <= passwordRequirements.maxLength },
]

function getStrength(value: string): { label: string; level: 0 | 1 | 2 | 3; color: string } {
  if (!value) return { label: "", level: 0, color: "bg-muted" }

  const passedCount = requirementList.filter((req) => req.check(value)).length
  const withinMax = value.length <= passwordRequirements.maxLength

  if (!withinMax || passedCount <= 2) return { label: "Fraca", level: 1, color: "bg-destructive" }
  if (passedCount <= 4) return { label: "Média", level: 2, color: "bg-amber-500" }
  return { label: "Forte", level: 3, color: "bg-green-500" }
}

export function PasswordInput({
  value = "",
  onChange,
  onBlur,
  disabled,
  placeholder,
  className,
  "aria-invalid": ariaInvalid,
  showStrength = false,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const strength = getStrength(value)

  return (
    <div className="space-y-2">
      <InputGroup className={className}>
        <InputGroupInput
          aria-invalid={ariaInvalid}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          maxLength={passwordRequirements.maxLength}
        />
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            type="button"
            size="icon-xs"
            variant="ghost"
            disabled={disabled}
            aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
            onClick={() => setVisible((v) => !v)}
          >
            {visible ? <EyeOff /> : <Eye />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>

      {showStrength && value && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex flex-1 gap-1">
              {[1, 2, 3].map((bar) => (
                <div
                  key={bar}
                  className={cn(
                    "h-1.5 flex-1 rounded-full bg-muted transition-colors",
                    strength.level >= bar && strength.color
                  )}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground shrink-0">{strength.label}</span>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            {requirementList.map((req) => {
              const passed = req.check(value)
              return (
                <li
                  key={req.key}
                  className={cn(
                    "flex items-center gap-1.5 text-xs",
                    passed ? "text-green-600 dark:text-green-500" : "text-destructive"
                  )}
                >
                  {passed ? <Check className="size-3.5 shrink-0" /> : <X className="size-3.5 shrink-0" />}
                  {req.label}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
