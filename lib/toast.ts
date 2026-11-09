"use client";

import type { ReactNode } from "react";
import { create } from "zustand";

/**
 * Drop-in replacement for the subset of sonner's `toast` API this app uses
 * (`toast()`, `.success/.error/.warning/.info/.loading`, `{ id }` to replace a toast,
 * `.dismiss`). Rendered by `<Toaster />` (components/ui/sonner.tsx) with MUI Snackbar + Alert.
 */
export type ToastKind = "default" | "success" | "error" | "warning" | "info" | "loading";

export type ToastOptions = {
  id?: string | number;
  description?: ReactNode;
  duration?: number;
};

export type ToastItem = {
  id: string | number;
  kind: ToastKind;
  message: ReactNode;
  description?: ReactNode;
  duration: number | null;
  open: boolean;
};

type ToastState = {
  toasts: ToastItem[];
  upsert: (item: ToastItem) => void;
  close: (id: string | number) => void;
  remove: (id: string | number) => void;
};

const MAX_VISIBLE = 4;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  upsert: (item) =>
    set((state) => {
      const exists = state.toasts.some((t) => t.id === item.id);
      const toasts = exists ? state.toasts.map((t) => (t.id === item.id ? item : t)) : [...state.toasts, item];
      return { toasts: toasts.slice(-MAX_VISIBLE) };
    }),
  close: (id) => set((state) => ({ toasts: state.toasts.map((t) => (t.id === id ? { ...t, open: false } : t)) })),
  remove: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

let counter = 0;

function show(kind: ToastKind, message: ReactNode, options?: ToastOptions) {
  const id = options?.id ?? `t${++counter}`;
  const defaultDuration = kind === "error" ? 6000 : 4000;
  useToastStore.getState().upsert({
    id,
    kind,
    message,
    description: options?.description,
    duration: kind === "loading" ? null : (options?.duration ?? defaultDuration),
    open: true,
  });
  return id;
}

type ToastFn = ((message: ReactNode, options?: ToastOptions) => string | number) & {
  success: (message: ReactNode, options?: ToastOptions) => string | number;
  error: (message: ReactNode, options?: ToastOptions) => string | number;
  warning: (message: ReactNode, options?: ToastOptions) => string | number;
  info: (message: ReactNode, options?: ToastOptions) => string | number;
  loading: (message: ReactNode, options?: ToastOptions) => string | number;
  dismiss: (id?: string | number) => void;
};

export const toast: ToastFn = Object.assign((message: ReactNode, options?: ToastOptions) => show("default", message, options), {
  success: (message: ReactNode, options?: ToastOptions) => show("success", message, options),
  error: (message: ReactNode, options?: ToastOptions) => show("error", message, options),
  warning: (message: ReactNode, options?: ToastOptions) => show("warning", message, options),
  info: (message: ReactNode, options?: ToastOptions) => show("info", message, options),
  loading: (message: ReactNode, options?: ToastOptions) => show("loading", message, options),
  dismiss: (id?: string | number) => {
    const { toasts, close } = useToastStore.getState();
    if (id === undefined) toasts.forEach((t) => close(t.id));
    else close(id);
  },
});
