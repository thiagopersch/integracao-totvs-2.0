import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { getRequestContext } from "@/lib/tenant";
import { ENTITY_LABELS, type BlockingReference } from "@/lib/entity-relations";
import { notificationService } from "@/services/notification.service";
import type { Prisma } from "@prisma/client";

const ACTION_LABELS: Record<string, string> = {
  CREATE: "criou",
  UPDATE: "atualizou",
  DELETE: "excluiu",
  RESTORE: "restaurou",
  BULK_DELETE: "excluiu em massa",
  BULK_RESTORE: "restaurou em massa",
  ACTIVATE: "ativou",
  DEACTIVATE: "desativou",
  IMPORT_STANDARD_SENTENCES: "importou sentenças padrões para",
};

/** Best-effort human label for the affected record — most call sites pass a name/code/title-ish
 *  string field in newData or oldData; falls back to the raw id when none is found. */
function describeSubject(entityId: string, newData?: Record<string, unknown>, oldData?: Record<string, unknown>): string {
  const candidateKeys = ["name", "filter", "title", "code"];
  for (const source of [newData, oldData]) {
    if (!source) continue;
    for (const key of candidateKeys) {
      const value = source[key];
      if (typeof value === "string" && value.trim()) return value;
    }
  }
  return entityId;
}

export type AuditInput = {
  action: string;
  entity: string;
  entityId: string;
  organizationId?: string;
  userId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export const BULK_DELETE_BLOCKED_ACTION = "BULK_DELETE_BLOCKED";

export const auditService = {
  async log(input: AuditInput): Promise<void> {
    let organizationId = input.organizationId;
    let userId = input.userId;
    // Most call sites already have these from an earlier requirePermission()/getRequestContext()
    // in the same request but don't bother re-passing them here — recover them so every audited
    // event can still be broadcast as a notification below, not just the ones that pass them explicitly.
    if (!organizationId || !userId) {
      try {
        const ctx = await getRequestContext();
        organizationId = organizationId ?? ctx.organizationId;
        userId = userId ?? ctx.userId;
      } catch {
        // No session in context (e.g. a background scheduler tick) — proceed with whatever was passed in.
      }
    }

    try {
      const data: Prisma.AuditLogUncheckedCreateInput = {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
      };
      if (organizationId) data.organizationId = organizationId;
      if (userId) data.userId = userId;
      if (input.oldData) data.oldData = input.oldData as Prisma.InputJsonValue;
      if (input.newData) data.newData = input.newData as Prisma.InputJsonValue;
      if (input.ip) data.ip = input.ip;
      if (input.userAgent) data.userAgent = input.userAgent;
      await prisma.auditLog.create({ data });
      logger.info(`Audit: ${input.action} on ${input.entity} #${input.entityId}`, {
        userId,
        action: input.action,
        entity: input.entity,
      });
    } catch (error) {
      logger.error("Failed to create audit log", { error });
    }

    // BULK_DELETE_BLOCKED is an internal bookkeeping marker for the deletion-errors log page, not
    // a real user action — never worth a notification, and a blocked bulk delete already surfaces
    // its own toast to the user who triggered it.
    if (organizationId && input.action !== BULK_DELETE_BLOCKED_ACTION) {
      try {
        const entityLabel = ENTITY_LABELS[input.entity] ?? input.entity;
        const actionLabel = ACTION_LABELS[input.action] ?? input.action.toLowerCase();
        const subject = describeSubject(input.entityId, input.newData, input.oldData);
        const actor = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }) : null;
        const actorName = actor?.name ?? "Sistema";
        await notificationService.broadcastToOrganization(
          organizationId,
          {
            type: `audit.${input.entity.toLowerCase()}.${input.action.toLowerCase()}`,
            title: `${entityLabel}: ${subject}`,
            body: `${actorName} ${actionLabel} um registro em ${entityLabel}.`,
            data: { entity: input.entity, entityId: input.entityId, action: input.action },
          },
          userId
        );
      } catch (error) {
        logger.error("Failed to broadcast notification for audit event", { error });
      }
    }
  },

  /**
   * Feeds the centralized "deletion errors" log page: one AuditLog row per
   * record that a bulk delete skipped because another registry still
   * references it (see repositories/base.repository.ts#bulkSoftDelete).
   */
  async logBulkDeleteBlocked(
    entity: string,
    blocked: { id: string; reasons: BlockingReference[] }[],
    organizationId?: string,
    userId?: string
  ): Promise<void> {
    await Promise.all(
      blocked.map((b) =>
        this.log({
          action: BULK_DELETE_BLOCKED_ACTION,
          entity,
          entityId: b.id,
          organizationId,
          userId,
          newData: { reasons: b.reasons },
        })
      )
    );
  },

  async listBulkDeleteBlocked(
    organizationId: string,
    page = 1,
    pageSize = 20,
    sort?: { field: string; direction: "asc" | "desc" }
  ) {
    const where = { action: BULK_DELETE_BLOCKED_ACTION, organizationId };
    const orderBy = sort ? { [sort.field]: sort.direction } : { createdAt: "desc" as const };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },

  async list(entity: string, entityId?: string, page = 1, pageSize = 50) {
    const where = { entity, ...(entityId ? { entityId } : {}) };
    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  },
};
