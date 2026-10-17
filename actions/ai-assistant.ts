"use server"

import { z } from "zod";
import { requirePermission } from "@/lib/rbac";
import { getDemandAnalystScope } from "@/lib/demand-scope";
import { getDemandFormData } from "@/actions/demands";
import { isMissingTableError, logMigrationPending } from "@/lib/prisma-errors";
import { aiDemandAssistantService, type AssistantCatalogs } from "@/services/ai-demand-assistant.service";

const messagesSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(20000) }))
  .min(1)
  .max(60);

const active = <T extends { status?: boolean | null }>(items: T[]) => items.filter((i) => i.status !== false);
const toItems = (items: { id: string; name: string }[]) => items.map((i) => ({ id: i.id, name: i.name }));

/** Whether the "Assistente IA" button should be shown on /demands. */
export async function getAiAssistantEnabled() {
  const { organizationId } = await requirePermission("demands", "create");
  try {
    return await aiDemandAssistantService.isEnabled(organizationId);
  } catch (error) {
    // A database without this branch's migrations must not take the whole /demands page down.
    if (!isMissingTableError(error)) throw error;
    logMigrationPending("Assistente IA", error);
    return false;
  }
}

/**
 * Sends the conversation to the configured AI and returns demands to preview. Nothing is written:
 * the user confirms each proposal, which goes through the regular createDemand action.
 */
export async function proposeDemandsWithAi(messages: unknown) {
  const ctx = await requirePermission("demands", "create");
  const parsed = messagesSchema.safeParse(messages);
  if (!parsed.success) return { success: false as const, error: "Mensagem inválida" };

  try {
    const [{ catalogs, context }, analystScope] = await Promise.all([getDemandFormData(), getDemandAnalystScope(ctx)]);
    const assistantCatalogs: AssistantCatalogs = {
      clients: toItems(active(catalogs.clients)),
      // A non-privileged user only launches demands for their own analyst.
      analysts: toItems(active(catalogs.analysts).filter((a) => !analystScope || a.id === analystScope)),
      requesters: toItems(active(catalogs.requesters)),
      departments: toItems(catalogs.departments),
      demandTypes: toItems(catalogs.demandTypes),
    };
    const result = await aiDemandAssistantService.propose({
      organizationId: ctx.organizationId,
      messages: parsed.data,
      catalogs: assistantCatalogs,
      defaultAnalystId: analystScope ?? context.myAnalystId,
      analystScope,
    });
    return { success: true as const, ...result, analystScope: analystScope ?? null };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
