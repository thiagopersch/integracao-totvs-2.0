import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const notificationService = {
  async list(organizationId: string, userId: string, page = 1, pageSize = 20, unreadOnly = false) {
    const where = { organizationId, userId, ...(unreadOnly ? { readAt: null } : {}) };
    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({ where: { organizationId, userId, readAt: null } }),
    ]);

    return {
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      unreadCount,
    };
  },

  async create(data: { organizationId: string; userId: string; type: string; title: string; body: string; data?: Record<string, unknown> }) {
    return prisma.notification.create({ data: { ...data, data: data.data as Prisma.InputJsonValue } });
  },

  async markAsRead(id: string, userId: string) {
    return prisma.notification.update({ where: { id, userId }, data: { readAt: new Date() } });
  },

  async markAllAsRead(organizationId: string, userId: string) {
    return prisma.notification.updateMany({
      where: { organizationId, userId, readAt: null },
      data: { readAt: new Date() },
    });
  },
};
