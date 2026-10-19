"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AiAssistant } from "@/components/ai-assistant/ai-assistant"
import { getAiAssistantBubbleEnabled } from "@/actions/ai-assistant"

/** Floating "Assistente IA" chat bubble on every page after login (it lives in the dashboard layout;
 *  login and password reset are outside it) — shown only when the AI assistant is enabled
 *  (Integrações > Assistente IA) and the user can create at least one of its entities. */
export function AiAssistantBubble() {
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

  if (!enabled) return null
  return <AiAssistant onCreated={() => router.refresh()} />
}
