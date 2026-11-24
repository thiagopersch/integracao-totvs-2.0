"use client"

import IconButton from "@mui/material/IconButton"
import { Eye, EyeOff } from "lucide-react"
import { useState, type ComponentProps } from "react"
import { COOKIE_TEXTAREA_PROPS } from "@/components/ps-docs/credentials-help"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

/** The cookie textarea, masked by default like a password field, with an eye button to reveal it.
 *  It stays a textarea (not `type="password"`, see `COOKIE_TEXTAREA_PROPS`): the text is masked
 *  with `-webkit-text-security`, so password managers don't treat it as a login. */
export function CookieTextarea({ className, ...props }: ComponentProps<typeof Textarea>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Textarea
        {...COOKIE_TEXTAREA_PROPS}
        {...props}
        className={cn(COOKIE_TEXTAREA_PROPS.className, "pr-10", !visible && "[&_textarea]:[-webkit-text-security:disc]", className)}
      />
      <IconButton
        size="small"
        className="!absolute top-1 right-1"
        aria-label={visible ? "Ocultar cookie" : "Mostrar cookie"}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </IconButton>
    </div>
  )
}
