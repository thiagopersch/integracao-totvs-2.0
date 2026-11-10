"use client"

import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

// The assistant (chat, proposal cards, catalogs) is only downloaded for users who have it.
const AiAssistant = dynamic(() => import("@/components/ai-assistant/ai-assistant").then((m) => m.AiAssistant), { ssr: false })

/** Floating "Assistente IA" chat bubble on every page after login — shown only when the AI assistant
 *  is enabled (Integrações > Assistente IA) and the user can create at least one of its entities.
 *  `enabled` is resolved by the server layout. */
export function AiAssistantBubble({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  if (!enabled) return null
  return <AiAssistant onCreated={() => router.refresh()} />
}
