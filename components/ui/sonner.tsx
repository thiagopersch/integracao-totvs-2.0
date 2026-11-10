"use client"

import Alert from "@mui/material/Alert"
import AlertTitle from "@mui/material/AlertTitle"
import CircularProgress from "@mui/material/CircularProgress"
import Slide from "@mui/material/Slide"
import Stack from "@mui/material/Stack"
import { useEffect } from "react"
import { useToastStore, type ToastItem } from "@/lib/toast"

function ToastCard({ item }: { item: ToastItem }) {
  const close = useToastStore((s) => s.close)
  const remove = useToastStore((s) => s.remove)

  useEffect(() => {
    if (!item.open || item.duration === null) return
    const timer = setTimeout(() => close(item.id), item.duration)
    return () => clearTimeout(timer)
  }, [item.open, item.duration, item.id, close, item.message])

  const severity = item.kind === "default" || item.kind === "loading" ? "info" : item.kind
  const icon = item.kind === "loading" ? <CircularProgress size={18} color="inherit" /> : item.kind === "default" ? false : undefined

  return (
    <Slide in={item.open} direction="left" mountOnEnter unmountOnExit onExited={() => remove(item.id)}>
      <Alert
        role="status"
        severity={severity}
        variant="filled"
        icon={icon}
        onClose={item.kind === "loading" ? undefined : () => close(item.id)}
        sx={{
          width: { xs: "calc(100vw - 32px)", sm: 360 },
          boxShadow: 6,
          alignItems: "center",
          ...(item.kind === "default" && { bgcolor: "background.paper", color: "text.primary" }),
        }}
      >
        {item.description ? <AlertTitle sx={{ mb: 0 }}>{item.message}</AlertTitle> : item.message}
        {item.description}
      </Alert>
    </Slide>
  )
}

/** Toast stack (bottom-right) driven by `toast()` from `@/lib/toast`. Mount once in the root layout. */
function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  return (
    <Stack
      spacing={1}
      aria-live="polite"
      sx={{ position: "fixed", right: 16, bottom: 16, zIndex: (theme) => theme.zIndex.snackbar, alignItems: "flex-end", pointerEvents: "none", "& > *": { pointerEvents: "auto" } }}
    >
      {toasts.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </Stack>
  )
}

export { Toaster }
