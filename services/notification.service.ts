import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const notificationService = {
  async list(
    organizationId: string,
    userId: string,
    page = 1,
    pageSize = 20,
    unreadOnly = false,
    sort?: { field: string; direction: "asc" | "desc" }
  ) {
    const where = { organizationId, userId, ...(unreadOnly ? { readAt: null } : {}) };
    const orderBy = sort ? { [sort.field]: sort.direction } : { createdAt: "desc" as const };
    const [data, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy,
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

  /**
   * Fans a single event out to every active user in the organization (minus the user who
   * triggered it, if any) — the one place that turns an audited/system event into something
   * everyone actually sees in the bell/notifications page.
   */
  async broadcastToOrganization(
    organizationId: string,
    payload: { type: string; title: string; body: string; data?: Record<string, unknown> },
    excludeUserId?: string
  ) {
    const users = await prisma.user.findMany({
      where: {
        organizationId,
        status: true,
        deletedAt: null,
        ...(excludeUserId ? { id: { not: excludeUserId } } : {}),
      },
      select: { id: true },
    });
    if (users.length === 0) return;

    await prisma.notification.createMany({
      data: users.map((u) => ({
        organizationId,
        userId: u.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data as Prisma.InputJsonValue,
      })),
    });
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
