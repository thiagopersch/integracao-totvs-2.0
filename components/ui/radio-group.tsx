"use client"

import * as React from "react"
import Radio from "@mui/material/Radio"

import { cn } from "@/lib/utils"

const RadioContext = React.createContext<{ value?: string | null; setValue: (value: string) => void; name: string; disabled?: boolean } | null>(null)

function RadioGroup({
  className,
  value,
  defaultValue,
  onValueChange,
  name,
  disabled,
  children,
  ...props
}: Omit<React.ComponentProps<"div">, "defaultValue"> & {
  value?: string | null
  defaultValue?: string
  onValueChange?: (value: never) => void
  name?: string
  disabled?: boolean
}) {
  const [inner, setInner] = React.useState(defaultValue)
  const current = value !== undefined ? value : inner
  const fallbackName = React.useId()
  return (
    <RadioContext.Provider
      value={{
        value: current,
        setValue: (next) => {
          if (value === undefined) setInner(next)
          ;(onValueChange as ((v: string) => void) | undefined)?.(next)
        },
        name: name ?? fallbackName,
        disabled,
      }}
    >
      <div role="radiogroup" data-slot="radio-group" className={cn("grid w-full gap-2", className)} {...props}>
        {children}
      </div>
    </RadioContext.Provider>
  )
}

function RadioGroupItem({ className, value, id, disabled }: { className?: string; value: string; id?: string; disabled?: boolean }) {
  const ctx = React.useContext(RadioContext)
  return (
    <Radio
      data-slot="radio-group-item"
      id={id}
      value={value}
      name={ctx?.name}
      checked={ctx?.value === value}
      disabled={disabled ?? ctx?.disabled}
      onChange={() => ctx?.setValue(value)}
      size="small"
      className={cn("shrink-0", className)}
      sx={{ p: 0.75 }}
    />
  )
}

export { RadioGroup, RadioGroupItem }
