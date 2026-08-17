import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export type AuditInput = {
  action: string;
  entity: string;
  entityId: string;
  userId?: string;
  oldData?: Record<string, unknown>;
  newData?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
};

export const auditService = {
  async log(input: AuditInput): Promise<void> {
    try {
      const data: Record<string, unknown> = {
        action: input.action,
        entity: input.entity,
        entityId: input.entityId,
      };
      if (input.userId) data.userId = input.userId;
      if (input.oldData) data.oldData = input.oldData;
      if (input.newData) data.newData = input.newData;
      if (input.ip) data.ip = input.ip;
      if (input.userAgent) data.userAgent = input.userAgent;
      await prisma.auditLog.create({ data: data as any });
      logger.info(`Audit: ${input.action} on ${input.entity} #${input.entityId}`, {
        userId: input.userId,
        action: input.action,
        entity: input.entity,
      });
    } catch (error) {
      logger.error("Failed to create audit log", { error });
    }
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
