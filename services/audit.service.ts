import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import type { BlockingReference } from "@/lib/entity-relations";
import type { Prisma } from "@prisma/client";

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
    try {
      const data: Prisma.AuditLogUncheckedCreateInput = {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
      };
      if (input.organizationId) data.organizationId = input.organizationId;
      if (input.userId) data.userId = input.userId;
      if (input.oldData) data.oldData = input.oldData as Prisma.InputJsonValue;
      if (input.newData) data.newData = input.newData as Prisma.InputJsonValue;
      if (input.ip) data.ip = input.ip;
      if (input.userAgent) data.userAgent = input.userAgent;
      await prisma.auditLog.create({ data });
      logger.info(`Audit: ${input.action} on ${input.entity} #${input.entityId}`, {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
      });
    } catch (error) {
      logger.error("Failed to create audit log", { error });
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

  async listBulkDeleteBlocked(organizationId: string, page = 1, pageSize = 20) {
    const where = { action: BULK_DELETE_BLOCKED_ACTION, organizationId };
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
