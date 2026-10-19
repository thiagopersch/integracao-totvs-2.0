"use server"

import { z } from "zod";
import { updateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/rbac";
import { getRequestContext, type RequestContext } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { findLinkedAnalystId, getDemandAnalystScope } from "@/lib/demand-scope";
import { isMissingTableError, logMigrationPending } from "@/lib/prisma-errors";
import { AI_ENTITIES, AI_ENTITY_KEYS, type AiCatalogItem, type AiCatalogKey, type AiCatalogs, type AiEntityKey } from "@/lib/ai/entities";
import { aiAssistantService } from "@/services/ai-assistant.service";
import { projectService, projectScopeWhere } from "@/services/project.service";
import { resolveStage } from "@/services/project-task.service";
import { listAllClients } from "@/actions/admin/clients";
import { listAllAnalysts } from "@/actions/analysts";
import { listAllRequesters } from "@/actions/requesters";
import { listAllDepartments } from "@/actions/departments";
import { listAllDemandTypes } from "@/actions/demand-types";
import { listAllTags } from "@/actions/tags";
import { getProjectPickerOptions } from "@/queries/projects";
import { aiConversationsTag, listAiConversations } from "@/queries/ai-conversations";
import { aiConversationService } from "@/services/ai-conversation.service";
import { formatDateOnly } from "@/utils/format";

const messagesSchema = z
  .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(20000) }))
  .min(1)
  .max(60);

const active = <T extends { status?: boolean | null }>(items: T[]) => items.filter((i) => i.status !== false);
const toItems = (items: { id: string; name: string }[]): AiCatalogItem[] => items.map((i) => ({ id: i.id, name: i.name }));

/** Entities the user may create through the assistant (their regular create permission). */
function creatableEntities(ctx: RequestContext): AiEntityKey[] {
  return AI_ENTITY_KEYS.filter((key) => hasPermission(ctx.permissions, AI_ENTITIES[key].resource, "create"));
}

/** Lookup lists the creatable entities reference — scoped like the regular forms (client access, analyst scope). */
async function loadCatalogs(ctx: RequestContext, entities: AiEntityKey[], analystScope: string | undefined): Promise<AiCatalogs> {
  const needed = new Set<AiCatalogKey>();
  for (const key of entities) for (const f of AI_ENTITIES[key].fields) if (f.ref) needed.add(f.ref);
  const want = (k: AiCatalogKey) => needed.has(k);

  const [clients, analysts, requesters, departments, demandTypes, tags, picker, projects] = await Promise.all([
    want("clients") ? listAllClients() : null,
    want("analysts") ? listAllAnalysts() : null,
    want("requesters") ? listAllRequesters() : null,
    want("departments") ? listAllDepartments() : null,
    want("demandTypes") ? listAllDemandTypes() : null,
    want("tags") ? listAllTags() : null,
    want("contracts") || want("users") ? getProjectPickerOptions(ctx.organizationId, ctx.allowedClientIds) : null,
    want("projects") || want("stages")
      ? prisma.project.findMany({
          where: { organizationId: ctx.organizationId, deletedAt: null, ...projectScopeWhere(ctx.allowedClientIds) },
          select: {
            id: true,
            code: true,
            name: true,
            clientId: true,
            stages: { where: { deletedAt: null }, orderBy: { position: "asc" }, select: { id: true, name: true } },
          },
          orderBy: { name: "asc" },
        })
      : null,
  ]);

  const catalogs: AiCatalogs = {};
  if (clients) catalogs.clients = toItems(active(clients));
  // A non-privileged user only launches demands for their own analyst.
  if (analysts) catalogs.analysts = toItems(active(analysts).filter((a) => !analystScope || a.id === analystScope));
  if (requesters) catalogs.requesters = toItems(active(requesters));
  if (departments) catalogs.departments = toItems(departments);
  if (demandTypes) catalogs.demandTypes = toItems(demandTypes);
  if (tags) catalogs.tags = toItems(tags);
  if (picker && want("contracts")) {
    catalogs.contracts = picker.contracts.map((c) => ({
      id: c.id,
      name: `${Number(c.contractedHours)} h/mês desde ${formatDateOnly(c.startDate)} (${c.status})`,
      parentId: c.clientId,
    }));
  }
  if (picker && want("users")) catalogs.users = toItems(picker.users);
  if (projects && want("projects")) catalogs.projects = projects.map((p) => ({ id: p.id, name: `${p.code} - ${p.name}`, parentId: p.clientId }));
  if (projects && want("stages")) catalogs.stages = projects.flatMap((p) => p.stages.map((s) => ({ id: s.id, name: s.name, parentId: p.id })));
  return catalogs;
}

async function ensureEnabled(organizationId: string) {
  try {
    return await aiAssistantService.isEnabled(organizationId);
  } catch (error) {
    // A database without this branch's migrations must not take the whole page down.
    if (!isMissingTableError(error)) throw error;
    logMigrationPending("Assistente IA", error);
    return false;
  }
}

/** Whether the floating assistant bubble (every dashboard page) should be shown — never throws:
 *  users who can't create any of the assistant's entities simply don't get it. */
export async function getAiAssistantBubbleEnabled() {
  try {
    const ctx = await getRequestContext();
    if (!creatableEntities(ctx).length) return false;
    return await ensureEnabled(ctx.organizationId);
  } catch {
    return false;
  }
}

/** Entities and lookup lists for the preview cards, loaded when the assistant opens. */
export async function getAiAssistantData() {
  const ctx = await getRequestContext();
  const entities = creatableEntities(ctx);
  const analystScope = entities.includes("demand") ? await getDemandAnalystScope(ctx) : undefined;
  return { entities, catalogs: await loadCatalogs(ctx, entities, analystScope), analystScope: analystScope ?? null };
}

/**
 * Sends the conversation to the configured AI and returns records to preview. Nothing is written:
 * the user confirms each proposal, which goes through the entity's regular create action.
 */
export async function proposeRecordsWithAi(messages: unknown) {
  const ctx = await getRequestContext();
  const entities = creatableEntities(ctx);
  if (!entities.length) return { success: false as const, error: "Você não tem permissão para criar cadastros" };
  const parsed = messagesSchema.safeParse(messages);
  if (!parsed.success) return { success: false as const, error: "Mensagem inválida" };

  try {
    const [analystScope, myAnalystId] = entities.includes("demand")
      ? await Promise.all([getDemandAnalystScope(ctx), findLinkedAnalystId(ctx.userId)])
      : [undefined, null];
    const catalogs = await loadCatalogs(ctx, entities, analystScope);
    const result = await aiAssistantService.propose({
      organizationId: ctx.organizationId,
      messages: parsed.data,
      entities,
      catalogs,
      defaultAnalystId: analystScope ?? myAnalystId,
      analystScope,
    });
    return { success: true as const, ...result };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

/** Stage a task proposed without one goes to: the project's first "a fazer" stage. */
export async function getDefaultTaskStageId(projectId: string) {
  const ctx = await requirePermission("project_tasks", "create");
  try {
    await projectService.assertAccessible(projectId, ctx);
    const stage = await resolveStage(projectId);
    return { success: true as const, data: stage.id };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

// ── Conversation history (private to each user) ─────────────────────────────

const chatEntrySchema = z.object({
  role: z.enum(["user", "assistant"]),
  display: z.string().max(20000),
  questions: z.array(z.string().max(2000)).max(50).optional(),
  content: z.string().max(60000),
});

const proposalSchema = z.object({
  key: z.string().max(100),
  tempId: z.string().max(100),
  entity: z.enum(AI_ENTITY_KEYS),
  values: z.record(z.string(), z.string().max(20000)),
  created: z.boolean().optional(),
  createdId: z.string().max(100).optional(),
  reported: z.boolean().optional(),
});

const saveConversationSchema = z.object({
  id: z.string().max(100).optional(),
  chat: z.array(chatEntrySchema).min(1).max(200),
  proposals: z.array(proposalSchema).max(200),
});

export type SavedConversationState = Pick<z.output<typeof saveConversationSchema>, "chat" | "proposals">;

/** Previous conversations of the logged-in user, optionally filtered by title/content. */
export async function listAiConversationHistory(search?: string) {
  const { organizationId, userId } = await getRequestContext();
  return listAiConversations(organizationId, userId, typeof search === "string" ? search.slice(0, 200) : undefined);
}

export async function getAiConversation(id: string) {
  const { organizationId, userId } = await getRequestContext();
  const conversation = await aiConversationService.getById(id, { organizationId, userId });
  if (!conversation) return { success: false as const, error: "Conversa não encontrada" };
  const state = saveConversationSchema.omit({ id: true }).safeParse(conversation.state);
  if (!state.success) return { success: false as const, error: "Não foi possível abrir esta conversa" };
  return { success: true as const, data: { id: conversation.id, ...state.data } };
}

/** Creates or updates the conversation (title = first message); returns its id. */
export async function saveAiConversation(input: unknown) {
  const { organizationId, userId } = await getRequestContext();
  const parsed = saveConversationSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: "Conversa inválida" };
  const { id, chat, proposals } = parsed.data;
  const firstUser = chat.find((m) => m.role === "user")?.display ?? "Conversa";
  const title = firstUser.replace(/\s+/g, " ").trim().slice(0, 120) || "Conversa";
  const searchText = chat.map((m) => m.display).join("\n").slice(0, 100000);
  try {
    const savedId = await aiConversationService.save({ organizationId, userId }, { id, title, searchText, state: { chat, proposals } });
    updateTag(aiConversationsTag(userId));
    return { success: true as const, data: { id: savedId } };
  } catch (error) {
    // A database without this branch's migration keeps the assistant working, just without history.
    if (isMissingTableError(error)) {
      logMigrationPending("Histórico do Assistente IA", error);
      return { success: false as const, error: "Histórico indisponível" };
    }
    return { success: false as const, error: (error as Error).message };
  }
}

export async function deleteAiConversation(id: string) {
  const { organizationId, userId } = await getRequestContext();
  await aiConversationService.delete(id, { organizationId, userId });
  updateTag(aiConversationsTag(userId));
  return { success: true as const };
}
