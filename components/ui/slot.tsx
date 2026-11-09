"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

type AnyProps = Record<string, unknown>

/** Props every trigger-like part accepts (kept from the Base UI API the app was written against). */
export type TriggerProps = Omit<React.HTMLAttributes<HTMLElement>, "children"> & {
  children?: React.ReactNode
  /** Element to render instead of the default `<button>`; its props are merged with the trigger's. */
  render?: React.ReactElement<AnyProps>
  disabled?: boolean
  nativeButton?: boolean
  type?: "button" | "submit" | "reset"
}

function chain<E>(...handlers: Array<((event: E) => void) | undefined>) {
  return (event: E) => {
    for (const handler of handlers) handler?.(event)
  }
}

/**
 * Renders a trigger: the `render` element (merged like Base UI's `render` prop) or a plain
 * `<button type="button">`. `inject` carries the behaviour (onClick, ref, aria-*) from the owner.
 */
export function renderTrigger(
  { render, children, className, nativeButton: _nativeButton, ...props }: TriggerProps,
  inject: AnyProps & { onClick?: (event: React.MouseEvent<HTMLElement>) => void; ref?: React.Ref<HTMLElement> }
) {
  const { onClick: injectedClick, ref: injectedRef, ...rest } = inject
  // React 19 passes `ref` as a regular prop: keep the caller's (e.g. MUI Tooltip's) unless the owner needs its own.
  const ref = injectedRef ?? ((props as AnyProps).ref as React.Ref<HTMLElement> | undefined)
  if (render && React.isValidElement(render)) {
    const own = render.props
    return React.cloneElement(render, {
      ...props,
      ...rest,
      ref,
      className: cn(own.className as string | undefined, className),
      onClick: chain(own.onClick as ((e: React.MouseEvent<HTMLElement>) => void) | undefined, props.onClick, injectedClick),
      children: children ?? own.children,
    })
  }
  return (
    <button
      type="button"
      {...props}
      {...rest}
      ref={ref as React.Ref<HTMLButtonElement>}
      className={className}
      onClick={chain(props.onClick, injectedClick)}
    >
      {children}
    </button>
  )
}

/** Controlled-or-uncontrolled open state shared by Dialog, Popover, Menu, Sheet… */
export function useOpenState(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange?: (open: boolean) => void) {
  const [inner, setInner] = React.useState(defaultOpen ?? false)
  const isControlled = open !== undefined
  const value = isControlled ? open : inner
  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInner(next)
      onOpenChange?.(next)
    },
    [isControlled, onOpenChange]
  )
  return [value, setOpen] as const
}
