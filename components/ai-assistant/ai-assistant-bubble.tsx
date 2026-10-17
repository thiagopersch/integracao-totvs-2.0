"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AiDemandAssistant } from "@/components/demands/ai-demand-assistant"
import { getAiAssistantBubbleEnabled } from "@/actions/ai-assistant"

/** Floating "Assistente IA" chat bubble on every dashboard page — shown only when the AI assistant
 *  is enabled (Integrações > Assistente IA) and the user can create demands. /demands has its own
 *  toolbar button, so the bubble stays out of the way there. */
export function AiAssistantBubble() {
  const pathname = usePathname()
  const router = useRouter()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let cancelled = false
    getAiAssistantBubbleEnabled()
      .then((value) => !cancelled && setEnabled(value))
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  if (!enabled || pathname.startsWith("/demands")) return null
  return <AiDemandAssistant trigger="floating" onCreated={() => router.refresh()} />
}
