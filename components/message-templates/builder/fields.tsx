"use client"

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import type { BlockAlign } from "@/lib/message-templates/block-types"

export function FieldRow({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = 64,
  step = 1,
  suffix = "px",
}: {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  suffix?: string
}) {
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-3">
        <Slider
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        />
        <div className="relative w-20 shrink-0">
          <Input
            type="number"
            min={min}
            step={step}
            value={value}
            onChange={(e) => onChange(Math.max(min, Number(e.target.value) || 0))}
            className="h-8 pr-7 text-xs"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-[10px] text-muted-foreground">
            {suffix}
          </span>
        </div>
      </div>
    </FieldRow>
  )
}

/** Color swatch + hex input; `allowTransparent` adds a "Sem cor" toggle (backgrounds/borders). */
export function ColorField({
  label,
  value,
  onChange,
  allowTransparent,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  allowTransparent?: boolean
}) {
  const transparent = !value || value === "transparent"
  return (
    <FieldRow label={label}>
      <div className="flex items-center gap-2">
        <label
          className="relative h-8 w-10 shrink-0 cursor-pointer overflow-hidden rounded-md border"
          style={
            transparent
              ? { backgroundImage: "repeating-conic-gradient(#d4d4d8 0% 25%, #ffffff 0% 50%)", backgroundSize: "10px 10px" }
              : { backgroundColor: value }
          }
        >
          <input
            type="color"
            className="absolute inset-0 cursor-pointer opacity-0"
            value={transparent ? "#ffffff" : value}
            onChange={(e) => onChange(e.target.value)}
          />
        </label>
        <Input
          value={transparent ? "" : value}
          placeholder={allowTransparent ? "Sem cor" : "#000000"}
          onChange={(e) => onChange(e.target.value || (allowTransparent ? "transparent" : "#000000"))}
          className="h-8 font-mono text-xs"
        />
        {allowTransparent && !transparent && (
          <button
            type="button"
            className="shrink-0 text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => onChange("transparent")}
          >
            Limpar
          </button>
        )}
      </div>
    </FieldRow>
  )
}

export function SegmentedField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: React.ReactNode; title?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <FieldRow label={label}>
      <div className="flex w-full rounded-md border p-0.5">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-7 flex-1 items-center justify-center rounded-[5px] px-2 text-xs transition-colors",
              value === option.value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </FieldRow>
  )
}

export function AlignField({ value, onChange }: { value: BlockAlign; onChange: (value: BlockAlign) => void }) {
  return (
    <SegmentedField
      label="Alinhamento"
      value={value}
      onChange={onChange}
      options={[
        { value: "left", label: <AlignLeft className="h-3.5 w-3.5" />, title: "Esquerda" },
        { value: "center", label: <AlignCenter className="h-3.5 w-3.5" />, title: "Centro" },
        { value: "right", label: <AlignRight className="h-3.5 w-3.5" />, title: "Direita" },
      ]}
    />
  )
}
