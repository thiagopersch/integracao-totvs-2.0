"use client"

import * as React from "react"
import FormControl from "@mui/material/FormControl"
import InputLabel from "@mui/material/InputLabel"
import InputAdornment from "@mui/material/InputAdornment"
import OutlinedInput from "@mui/material/OutlinedInput"
import InputBase from "@mui/material/InputBase"

import { cn } from "@/lib/utils"
import { useFloatingLabel, type FloatingLabel } from "@/components/ui/field"

// Classes that style the text itself (padding, font, alignment…) go on the native <input>/<textarea>;
// the rest (width, height, margin, border, background…) on the MUI root.
const INNER = /^(?:[a-z-]+:)*(?:p[lrxytb]?-|text-(?:left|right|center|xs|sm|base|lg|\[)|font-|tracking-|tabular-nums|uppercase|lowercase|placeholder:|resize|min-h-|max-h-|leading-|field-sizing|caret-|selection:|file:|truncate|indent-)/
// With a floating label the root is a FormControl: sizes stay on the input box, the rest on the FormControl.
const BOX = /^(?:[a-z-]+:)*(?:h-|min-h-|max-h-|rounded|bg-|border)/

export function splitInputClasses(className?: string) {
  const inner: string[] = []
  const outer: string[] = []
  for (const token of (className ?? "").split(/\s+/).filter(Boolean)) (INNER.test(token) ? inner : outer).push(token)
  return { inner: inner.join(" "), outer: outer.join(" ") }
}

function splitBoxClasses(className: string) {
  const box: string[] = []
  const rest: string[] = []
  for (const token of className.split(/\s+/).filter(Boolean)) (BOX.test(token) ? box : rest).push(token)
  return { box: box.join(" "), rest: rest.join(" ") }
}

/** Native input types whose browser UI always shows something (mask, picker), so the label can't sit inside. */
const ALWAYS_SHRINK = new Set(["date", "time", "datetime-local", "month", "week", "color", "file", "range"])

const hasValue = (v: unknown) => v != null && String(v) !== ""

type ValueEl = HTMLInputElement | HTMLTextAreaElement

/**
 * Tracks whether an uncontrolled field has a value — including values set from code
 * (react-hook-form `reset()`/`setValue()` write `el.value` without firing events), by wrapping
 * the element's `value` setter.
 */
function useFilled(value: unknown, defaultValue: unknown) {
  const [filled, setFilled] = React.useState(() => hasValue(value ?? defaultValue))
  const controlled = value !== undefined
  const trackRef = React.useCallback((el: ValueEl | null) => {
    // Controlled fields already know their value; React writes `el.value` on every change there.
    if (!el || controlled) return
    setFilled(el.value !== "")
    if ((el as ValueEl & { __filledTracked?: boolean }).__filledTracked) return
    const own = Object.getOwnPropertyDescriptor(el, "value")
    const proto = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")
    const desc = own ?? proto
    if (!desc?.get || !desc.set) return
    const { get, set } = desc
    Object.defineProperty(el, "value", {
      configurable: true,
      enumerable: desc.enumerable,
      get() {
        return get.call(this)
      },
      set(next: string) {
        set.call(this, next)
        setFilled(next != null && String(next) !== "")
      },
    })
    ;(el as ValueEl & { __filledTracked?: boolean }).__filledTracked = true
  }, [controlled])
  return { filled: controlled ? hasValue(value) : filled, setFilled, trackRef }
}

function assignRef<T>(ref: React.Ref<T> | undefined, value: T | null) {
  if (typeof ref === "function") ref(value)
  else if (ref) (ref as React.RefObject<T | null>).current = value
}

type NativeInputProps = Omit<React.ComponentProps<"input">, "size" | "color">

type ExtraProps = {
  startAdornment?: React.ReactNode
  endAdornment?: React.ReactNode
}

/** Outlined text field with a Material floating label taken from the surrounding <Field>. */
function FloatingInput({
  floating,
  className,
  type,
  ref,
  style,
  disabled,
  startAdornment,
  endAdornment,
  multiline,
  rows,
  ...props
}: NativeInputProps &
  ExtraProps & {
    floating: FloatingLabel
    multiline?: boolean
    rows?: number
  }) {
  const { inner, outer } = splitInputClasses(className)
  const { box, rest } = splitBoxClasses(outer)
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  const [focused, setFocused] = React.useState(false)
  const { filled, setFilled, trackRef } = useFilled(props.value, props.defaultValue)
  const id = props.id ?? floating.id
  const shrink = floating.static || focused || filled || Boolean(startAdornment) || ALWAYS_SHRINK.has(type ?? "")
  const { onFocus, onBlur, onChange, onAnimationStart, ...native } = props as NativeInputProps & React.ComponentProps<"textarea">

  const setRef = React.useCallback(
    (el: ValueEl | null) => {
      trackRef(el)
      assignRef(ref as React.Ref<ValueEl>, el)
    },
    [ref, trackRef]
  )

  return (
    <FormControl
      variant="outlined"
      size="small"
      fullWidth
      error={invalid}
      disabled={disabled}
      className={cn("min-w-0", rest)}
      style={style}
      {...floating.rootProps}
    >
      <InputLabel htmlFor={floating.namedByField ? undefined : id} shrink={shrink} size="small">
        {floating.label}
      </InputLabel>
      <OutlinedInput
        data-slot={multiline ? "textarea" : "input"}
        type={type}
        label={floating.label}
        notched={shrink}
        multiline={multiline}
        rows={rows}
        inputRef={setRef}
        startAdornment={startAdornment ? <InputAdornment position="start">{startAdornment}</InputAdornment> : undefined}
        endAdornment={endAdornment ? <InputAdornment position="end">{endAdornment}</InputAdornment> : undefined}
        className={cn(multiline ? "text-sm" : "h-10 text-sm", box)}
        inputProps={
          {
            ...native,
            id,
            onFocus: (e: React.FocusEvent<ValueEl>) => {
              setFocused(true)
              ;(onFocus as React.FocusEventHandler<ValueEl> | undefined)?.(e)
            },
            onBlur: (e: React.FocusEvent<ValueEl>) => {
              setFocused(false)
              ;(onBlur as React.FocusEventHandler<ValueEl> | undefined)?.(e)
            },
            onChange: (e: React.ChangeEvent<ValueEl>) => {
              setFilled(e.target.value !== "")
              ;(onChange as React.ChangeEventHandler<ValueEl> | undefined)?.(e)
            },
            // Browser autofill (MUI's keyframe hook): the value isn't readable yet, but it's there.
            onAnimationStart: (e: React.AnimationEvent<ValueEl>) => {
              if (e.animationName === "mui-auto-fill") setFilled(true)
              ;(onAnimationStart as React.AnimationEventHandler<ValueEl> | undefined)?.(e)
            },
            className: cn(
              multiline ? "min-h-16 resize-y py-2" : "",
              "placeholder:text-muted-foreground",
              inner
            ),
          } as React.InputHTMLAttributes<HTMLInputElement>
        }
        sx={{
          ...(multiline ? { p: 0, alignItems: "stretch", "& .MuiOutlinedInput-input": { px: 1.75 } } : { "& .MuiOutlinedInput-input": { height: "100%", boxSizing: "border-box", py: 0 } }),
        }}
      />
    </FormControl>
  )
}

/** Outlined input without a label (outside a <Field>, toolbars, table filters…). */
function PlainInput({ className, type, ref, style, disabled, startAdornment, endAdornment, ...props }: NativeInputProps & ExtraProps) {
  const { inner, outer } = splitInputClasses(className)
  const invalid = props["aria-invalid"] === true || props["aria-invalid"] === "true"
  return (
    <OutlinedInput
      data-slot="input"
      type={type}
      inputRef={ref}
      disabled={disabled}
      error={invalid}
      startAdornment={startAdornment ? <InputAdornment position="start">{startAdornment}</InputAdornment> : undefined}
      endAdornment={endAdornment ? <InputAdornment position="end">{endAdornment}</InputAdornment> : undefined}
      className={cn("h-9 w-full min-w-0 text-sm", outer)}
      style={style}
      inputProps={{ ...props, className: cn("px-3 py-1 placeholder:text-muted-foreground", inner) } as React.InputHTMLAttributes<HTMLInputElement>}
      sx={{ "& .MuiOutlinedInput-input": { height: "100%", boxSizing: "border-box" } }}
    />
  )
}

/**
 * Internal: Input with adornments (PasswordInput, CurrencyInput). Inside a vertical <Field> it gets
 * the Field's label as a floating outlined label.
 */
function InputField(props: NativeInputProps & ExtraProps) {
  const floating = useFloatingLabel(props.id)
  if (floating) return <FloatingInput floating={floating} {...props} />
  return <PlainInput {...props} />
}

/**
 * Text input (MUI OutlinedInput). The `ref` reaches the native <input>, so react-hook-form's
 * `register()` keeps working; every native attribute goes to the <input> as well. Inside a
 * vertical <Field> the <FieldLabel> becomes the input's floating label.
 */
function Input(props: NativeInputProps) {
  return <InputField {...props} />
}

/** Borderless input for compound controls (InputGroup). */
function BareInput({ className, type, ref, style, disabled, ...props }: NativeInputProps) {
  const { inner, outer } = splitInputClasses(className)
  return (
    <InputBase
      type={type}
      inputRef={ref}
      disabled={disabled}
      className={cn("h-full w-full min-w-0 flex-1 text-sm", outer)}
      style={style}
      inputProps={{ ...props, className: cn("px-3 py-1 placeholder:text-muted-foreground", inner) } as React.InputHTMLAttributes<HTMLInputElement>}
      sx={{ "& .MuiInputBase-input": { height: "100%", boxSizing: "border-box" } }}
    />
  )
}

export { BareInput, FloatingInput, Input, InputField }
