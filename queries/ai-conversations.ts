// Cached reads for the Assistente IA history. Deliberately NOT a "use server" module — see
// queries/tags.ts. Callers resolve the request context first and pass the owner ids in.

import { cacheTag } from "next/cache";
import { aiConversationService } from "@/services/ai-conversation.service";

/** Invalidated by every save/delete of the user's conversations. */
export const aiConversationsTag = (userId: string) => `ai-conversations-${userId}`;

export async function listAiConversations(organizationId: string, userId: string, search?: string) {
  "use cache";
  cacheTag(aiConversationsTag(userId));
  return aiConversationService.list({ organizationId, userId }, search);
}
