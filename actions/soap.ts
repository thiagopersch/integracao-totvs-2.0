"use server"

import { updateTag } from "next/cache";
import { soapService, type WsName } from "@/services/soap.service";
import { soapEndpointService } from "@/services/soap-endpoint.service";
import { tbcService } from "@/services/tbc.service";
import { prisma } from "@/lib/prisma";
import { getRequestContext } from "@/lib/tenant";
import { requirePermission } from "@/lib/rbac";
import { auditService } from "@/services/audit.service";
import { z } from "zod";
import type { SoapBuilderSnapshot, SoapContext, SoapSavedCall } from "@/types/soap";
import { SoapMethod as SoapMethodEnum, type SoapMethod, type Prisma } from "@/generated/prisma/client";

export async function listSoapFavorites() {
  const { organizationId, userId } = await getRequestContext();
  return soapService.getFavorites(userId, organizationId);
}

export async function listSoapTemplates() {
  const { organizationId, userId } = await getRequestContext();
  return soapService.getTemplates(organizationId, userId);
}

export async function deleteSoapFavorite(id: string) {
  const { organizationId, userId } = await getRequestContext();
  try {
    const favorite = await prisma.soapFavorite.findFirst({ where: { id, userId, organizationId } });
    await soapService.deleteFavorite(id, userId, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "SoapFavorite",
      entityId: id,
      organizationId,
      userId,
      oldData: favorite ? { name: favorite.name, dataserver: favorite.dataserver, process: favorite.process, method: favorite.method } : undefined,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function deleteSoapTemplate(id: string) {
  const { organizationId } = await getRequestContext();
  try {
    const template = await prisma.soapTemplate.findFirst({ where: { id, organizationId } });
    await soapService.deleteTemplate(id, organizationId);
    await auditService.log({
      action: "DELETE",
      entity: "SoapTemplate",
      entityId: id,
      organizationId,
      oldData: template ? { name: template.name, dataserver: template.dataserver, process: template.process, method: template.method } : undefined,
    });
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Reruns a SOAP History entry exactly as it was sent. A log only stores the TBC's link/wsName —
 * not their ids — so this recovers the TBC by link and the endpoint type by its ws folder
 * (SoapLog.process), then resolves the method from /totvs/soap/endpoints like every other call.
 */
export async function reexecuteSoapLog(logId: string) {
  const { organizationId, userId, allowedClientIds } = await requirePermission("soap", "execute");
  try {
    const log = await prisma.soapLog.findFirst({ where: { id: logId, organizationId }, omit: { xmlRequest: false } });
    if (!log) return { success: false, error: "Registro de histórico não encontrado" };
    if (!log.dataserver || !log.process || !log.method || !log.xmlRequest) {
      return { success: false, error: "Este registro não tem dados suficientes para ser reexecutado" };
    }

    const tbcRow = await prisma.tbc.findFirst({ where: { link: log.dataserver, organizationId, deletedAt: null } });
    if (!tbcRow) return { success: false, error: `Nenhum TBC cadastrado com o link "${log.dataserver}"` };

    const tbc = await tbcService.getCredentialsForRequest(tbcRow.id, organizationId, allowedClientIds);
    const endpointType = await soapEndpointService.getActiveTypeBySuffix(log.process);
    const endpointMethod = await soapEndpointService.getActiveMethodByKey(endpointType.id, log.method);

    const result = await soapService.execute(
      {
        tbc,
        wsName: endpointType.suffix as WsName,
        method: endpointMethod.method as SoapMethod,
        xml: log.xmlRequest,
        context: (log.context as SoapContext | null) ?? undefined,
      },
      organizationId,
      userId
    );

    updateTag("dashboard");
    return { success: true, data: result };
  } catch (error) {
    // soapService.execute logs the SoapLog row even on failure, so the dashboard's
    // recent-executions box needs invalidating here too, not just on the success path.
    updateTag("dashboard");
    return { success: false, error: (error as Error).message };
  }
}

// ── Favorites / templates saved from the SOAP builder ─────────────────────────

const snapshotSchema = z.object({
  typeId: z.string().min(1, "Selecione o tipo de endpoint"),
  methodId: z.string().min(1, "Selecione o método"),
  sistemaId: z.string(),
  clientId: z.string(),
  tbcId: z.string(),
  dataserverId: z.string(),
  processId: z.string(),
  context: z.object({
    coligate: z.number().nullable(),
    branch: z.number().nullable(),
    levelEducation: z.number().nullable(),
    codSystem: z.string(),
    user: z.string(),
  }),
  timeout: z.number().int().positive(),
  sql: z
    .object({ codColigada: z.string(), codSentenca: z.string(), parameters: z.string(), context: z.string() })
    .optional(),
});

const savedCallSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(120),
  description: z.string().trim().max(500).optional(),
  /** Dataserver/process code, shown on the favorites/templates cards. */
  dataserver: z.string().optional(),
  process: z.string().optional(),
  /** Endpoint method key (e.g. "READVIEW"); kept only when it is a known SoapMethod. */
  method: z.string().optional(),
  xml: z.string(),
  snapshot: snapshotSchema,
});

export type SoapSavedCallInput = z.input<typeof savedCallSchema>;

function toSoapMethod(method?: string): SoapMethod | undefined {
  return method && method in SoapMethodEnum ? (method as SoapMethod) : undefined;
}

/** Same call = same endpoint type, method, TBC and catalog entry (the XML body may differ). */
function sameCall(a: SoapBuilderSnapshot, b: unknown): boolean {
  const o = b as Partial<SoapBuilderSnapshot> | null;
  return (
    !!o &&
    o.typeId === a.typeId &&
    o.methodId === a.methodId &&
    o.tbcId === a.tbcId &&
    o.dataserverId === a.dataserverId &&
    o.processId === a.processId
  );
}

function toSavedCall(
  kind: SoapSavedCall["kind"],
  row: { id: string; name: string; description?: string | null; xml?: string | null; xmlTemplate?: string | null; context: unknown }
): SoapSavedCall {
  const parsed = snapshotSchema.safeParse(row.context);
  return {
    id: row.id,
    kind,
    name: row.name,
    description: row.description ?? null,
    xml: row.xml ?? row.xmlTemplate ?? "",
    snapshot: parsed.success ? parsed.data : null,
  };
}

/** The current user's favorites and templates, as the builder's "Abrir" menu lists them. */
export async function listSoapSavedCalls(): Promise<{ favorites: SoapSavedCall[]; templates: SoapSavedCall[] }> {
  const { organizationId, userId } = await requirePermission("soap", "execute");
  const [favorites, templates] = await Promise.all([
    soapService.getFavorites(userId, organizationId),
    soapService.getTemplates(organizationId, userId),
  ]);
  return {
    favorites: favorites.map((f) => toSavedCall("favorite", f)),
    templates: templates.map((t) => toSavedCall("template", t)),
  };
}

/** Stars/unstars the builder's current call. Returns whether it is a favorite afterwards. */
export async function toggleSoapFavorite(input: SoapSavedCallInput) {
  const { organizationId, userId } = await requirePermission("soap", "execute");
  const parsed = savedCallSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const data = parsed.data;
  try {
    const favorites = await prisma.soapFavorite.findMany({ where: { userId, organizationId } });
    const existing = favorites.find((f) => sameCall(data.snapshot, f.context));
    if (existing) {
      await soapService.deleteFavorite(existing.id, userId, organizationId);
      await auditService.log({
        action: "DELETE",
        entity: "SoapFavorite",
        entityId: existing.id,
        organizationId,
        userId,
        oldData: { name: existing.name, dataserver: existing.dataserver, process: existing.process, method: existing.method },
      });
      return { success: true as const, favorited: false, id: existing.id };
    }
    const created = await prisma.soapFavorite.create({
      data: {
        organizationId,
        userId,
        name: data.name,
        dataserver: data.dataserver || null,
        process: data.process || null,
        method: toSoapMethod(data.method),
        xml: data.xml,
        context: data.snapshot as unknown as Prisma.InputJsonValue,
      },
    });
    await auditService.log({
      action: "CREATE",
      entity: "SoapFavorite",
      entityId: created.id,
      organizationId,
      userId,
      newData: { name: created.name, dataserver: created.dataserver, process: created.process, method: created.method },
    });
    return { success: true as const, favorited: true, id: created.id };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}

/** Saves the builder's current call (XML included) as a named template. */
export async function saveSoapTemplate(input: SoapSavedCallInput) {
  const { organizationId, userId } = await requirePermission("soap", "execute");
  const parsed = savedCallSchema.safeParse(input);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Dados inválidos" };
  const data = parsed.data;
  try {
    const created = await soapService.saveTemplate(
      {
        userId,
        name: data.name,
        description: data.description || undefined,
        dataserver: data.dataserver || undefined,
        process: data.process || undefined,
        method: toSoapMethod(data.method),
        xmlTemplate: data.xml,
        context: data.snapshot as unknown as Record<string, unknown>,
      },
      organizationId
    );
    await auditService.log({
      action: "CREATE",
      entity: "SoapTemplate",
      entityId: created.id,
      organizationId,
      userId,
      newData: { name: created.name, dataserver: created.dataserver, process: created.process, method: created.method },
    });
    return { success: true as const, id: created.id };
  } catch (error) {
    return { success: false as const, error: (error as Error).message };
  }
}
