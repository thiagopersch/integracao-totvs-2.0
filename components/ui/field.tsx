"use client"

import * as React from "react"
import { useMemo } from "react"

import { cn } from "@/lib/utils"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
  return (
    <fieldset
      data-slot="field-set"
      className={cn(
        "flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
        className
      )}
      {...props}
    />
  )
}

function FieldLegend({
  className,
  variant = "legend",
  ...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
  return (
    <legend
      data-slot="field-legend"
      data-variant={variant}
      className={cn(
        "mb-1.5 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base",
        className
      )}
      {...props}
    />
  )
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-group"
      className={cn(
        "group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
        className
      )}
      {...props}
    />
  )
}

const FIELD_BASE = "group/field flex w-full gap-2 data-[invalid=true]:text-destructive"
const FIELD_ORIENTATION = {
        vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
        horizontal:
          "flex-row items-center has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
        responsive:
          "flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
      } as const
type FieldOrientation = keyof typeof FIELD_ORIENTATION
const fieldVariants = ({ orientation = "vertical" }: { orientation?: FieldOrientation | null }) => cn(FIELD_BASE, FIELD_ORIENTATION[orientation ?? "vertical"])

/**
 * Floating labels. A vertical <Field> shares its <FieldLabel> with the first text-like control
 * rendered inside it (Input, Textarea, Select, Combobox, MultiSelect, pickers…): FieldLabel writes
 * its text into the Field's ref while rendering, and the control — which renders after it in the
 * same pass, also through a <Controller> — reads it and draws a Material outlined label in the
 * notch. The control marks itself `data-floating-label`, and CSS hides the original FieldLabel
 * (no effect, so SSR is already right). Labels with icons/tooltips (anything but text) are drawn
 * shrunk (static) in the notch; controls outside a Field keep working with no label.
 */
type FieldLabelInfo = { node: React.ReactNode; htmlFor?: string }
/** Per-Field mutable store, written during render (FieldLabel → control, same pass) by design. */
class FieldLabelStore {
  private label: FieldLabelInfo | null = null
  private owner: string | null = null
  setLabel(info: FieldLabelInfo) {
    this.label = info
  }
  getLabel() {
    return this.label
  }
  /** First control to ask owns the label; returns whether `id` is (now) the owner. */
  claim(id: string) {
    if (this.owner && this.owner !== id) return false
    this.owner = id
    return true
  }
  release(id: string) {
    if (this.owner === id) this.owner = null
  }
}
type FieldCtx = { orientation: FieldOrientation; store: FieldLabelStore }
const FieldContext = React.createContext<FieldCtx | null>(null)

function isPlainText(node: React.ReactNode): boolean {
  if (typeof node === "string" || typeof node === "number") return true
  if (Array.isArray(node)) return node.every((n) => n == null || typeof n === "boolean" || isPlainText(n))
  return false
}

export type FloatingLabel = {
  /** The label content (text, or a node when `static`). */
  label: React.ReactNode
  /** Label has non-text content (icon, tooltip, asterisk element): keep it shrunk in the notch. */
  static: boolean
  /** Id the control should use so the label points at it. */
  id?: string
  /**
   * The (hidden) FieldLabel already names the control through `htmlFor`: the floating label must
   * not point at it too, or the accessible name doubles ("E-mail E-mail").
   */
  namedByField: boolean
  /** Spread on the control's root so the Field hides its own FieldLabel. */
  rootProps: { "data-floating-label": "" }
}

/** For text-like controls: the label of the surrounding <Field>, claimed by the first control that asks. */
function useFloatingLabel(id?: string): FloatingLabel | null {
  const ctx = React.useContext(FieldContext)
  const me = React.useId()
  const store = ctx?.store
  React.useEffect(() => (store ? () => store.release(me) : undefined), [store, me])
  if (!ctx || !store || ctx.orientation !== "vertical") return null
  const info = store.getLabel()
  if (!info || info.node == null || info.node === false) return null
  if (info.htmlFor && id && info.htmlFor !== id) return null
  if (!store.claim(me)) return null
  return {
    label: info.node,
    static: !isPlainText(info.node),
    id: id ?? info.htmlFor,
    namedByField: Boolean(info.htmlFor),
    rootProps: { "data-floating-label": "" },
  }
}

/** Props for a MUI TextField (Autocomplete, pickers) that shows the Field's floating label. */
function floatingTextFieldProps(
  floating: FloatingLabel | null,
  inputLabel?: object
): { label?: React.ReactNode; slotProps?: { inputLabel: object }; "data-floating-label"?: "" } {
  if (!floating) return {}
  return {
    ...floating.rootProps,
    label: floating.label,
    slotProps: {
      inputLabel: { ...inputLabel, ...(floating.static ? { shrink: true } : {}), ...(floating.namedByField ? { htmlFor: undefined } : {}) },
    },
  }
}

function Field({
  className,
  orientation = "vertical",
  ...props
}: React.ComponentProps<"div"> & { orientation?: FieldOrientation | null }) {
  const [store] = React.useState(() => new FieldLabelStore())
  const ctx = React.useMemo<FieldCtx>(() => ({ orientation: orientation ?? "vertical", store }), [orientation, store])
  return (
    <FieldContext.Provider value={ctx}>
      <div
        role="group"
        data-slot="field"
        data-orientation={orientation}
        className={cn(fieldVariants({ orientation }), "[&:has([data-floating-label])_[data-field-label]]:hidden", className)}
        {...props}
      />
    </FieldContext.Provider>
  )
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-content"
      className={cn("group/field-content flex flex-1 flex-col gap-0.5 leading-snug", className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<typeof Label>) {
  const ctx = React.useContext(FieldContext)
  // Written during render on purpose: the control below reads it in this same render pass.
  ctx?.store.setLabel({ node: props.children, htmlFor: props.htmlFor })
  return (
    <Label
      data-slot="field-label"
      data-field-label=""
      className={cn(
        "group/field-label peer/field-label flex w-fit gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-[.Mui-checked]:border-primary/30 has-[.Mui-checked]:bg-primary/5 has-[>[data-slot=field]]:rounded-lg has-[>[data-slot=field]]:border *:data-[slot=field]:p-2.5 dark:has-[.Mui-checked]:border-primary/20 dark:has-[.Mui-checked]:bg-primary/10",
        "has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
        className
      )}
      {...props}
    />
  )
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="field-label"
      className={cn(
        "flex w-fit items-center gap-2 text-sm font-medium group-data-[disabled=true]/field:opacity-50",
        className
      )}
      {...props}
    />
  )
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="field-description"
      className={cn(
        "text-left text-xs leading-normal font-normal text-muted-foreground group-has-data-horizontal/field:text-balance group-has-data-floating-label/field:-mt-1 group-has-data-floating-label/field:px-3.5 [[data-variant=legend]+&]:-mt-1.5",
        "last:mt-0 nth-last-2:-mt-1",
        "[&>a]:underline [&>a]:underline-offset-4 [&>a:hover]:text-primary",
        className
      )}
      {...props}
    />
  )
}

function FieldSeparator({
  children,
  className,
  ...props
}: React.ComponentProps<"div"> & {
  children?: React.ReactNode
}) {
  return (
    <div
      data-slot="field-separator"
      data-content={!!children}
      className={cn(
        "relative -my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2",
        className
      )}
      {...props}
    >
      <Separator className="absolute inset-0 top-1/2" />
      {children && (
        <span
          className="relative mx-auto block w-fit bg-background px-2 text-muted-foreground"
          data-slot="field-separator-content"
        >
          {children}
        </span>
      )}
    </div>
  )
}

function FieldError({
  className,
  children,
  errors,
  ...props
}: React.ComponentProps<"div"> & {
  errors?: ({ message?: string } | undefined)[]
}) {
  const content = useMemo(() => {
    if (children) {
      return children
    }

    if (!errors?.length) {
      return null
    }

    const uniqueErrors = [...new Map(errors.map((error) => [error?.message, error])).values()]

    if (uniqueErrors?.length == 1) {
      return uniqueErrors[0]?.message
    }

    return (
      <ul className="ml-4 flex list-disc flex-col gap-1">
        {uniqueErrors.map((error, index) => error?.message && <li key={index}>{error.message}</li>)}
      </ul>
    )
  }, [children, errors])

  if (!content) {
    return null
  }

  return (
    <div role="alert" data-slot="field-error" className={cn("text-xs font-normal text-destructive group-has-data-floating-label/field:-mt-1 group-has-data-floating-label/field:px-3.5", className)} {...props}>
      {content}
    </div>
  )
}

export {
  floatingTextFieldProps,
  useFloatingLabel,
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLegend,
  FieldSeparator,
  FieldSet,
  FieldContent,
  FieldTitle,
}
