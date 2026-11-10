"use client"

import * as React from "react"
import MuiSlider from "@mui/material/Slider"

import { cn } from "@/lib/utils"

function Slider({
  className,
  value,
  defaultValue,
  onValueChange,
  onValueCommitted,
  min = 0,
  max = 100,
  step = 1,
  disabled,
}: {
  className?: string
  value?: number | number[]
  defaultValue?: number | number[]
  onValueChange?: (value: never) => void
  onValueCommitted?: (value: never) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <div className={cn("w-full px-1.5", className)}>
      <MuiSlider
        data-slot="slider"
        size="small"
        value={value}
        defaultValue={defaultValue}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        valueLabelDisplay="auto"
        onChange={(_event, next) => (onValueChange as ((v: number | number[]) => void) | undefined)?.(next)}
        onChangeCommitted={(_event, next) => (onValueCommitted as ((v: number | number[]) => void) | undefined)?.(next)}
      />
    </div>
  )
}

export { Slider }
