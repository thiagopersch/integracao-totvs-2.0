import { prisma } from "@/lib/prisma";
import { emitToUser } from "@/lib/notification-events";
import { sendEmail } from "@/lib/mailer";
import type { Notification, NotificationChannel, Prisma, UserRoleLevel } from "@prisma/client";

/**
 * Live-pushes each new row over SSE (see app/api/notifications/stream/route.ts) and, for
 * recipients who opted into the EMAIL channel (NotificationSetting, opt-in — no row means
 * disabled), sends it by mail too. Fire-and-forget-safe: email failures are logged inside
 * sendEmail and never block the in-app notification from having been created.
 */
async function dispatch(notifications: Notification[]): Promise<void> {
  if (notifications.length === 0) return;

  for (const notification of notifications) {
    emitToUser(notification.userId, notification);
  }

  const userIds = [...new Set(notifications.map((n) => n.userId))];
  const emailSettings = await prisma.notificationSetting.findMany({
    where: { userId: { in: userIds }, channel: "EMAIL", enabled: true },
    select: { userId: true },
  });
  const emailEnabledUserIds = new Set(emailSettings.map((s) => s.userId));
  if (emailEnabledUserIds.size === 0) return;

  const users = await prisma.user.findMany({
    where: { id: { in: [...emailEnabledUserIds] } },
    select: { id: true, email: true },
  });
  const emailByUserId = new Map(users.map((u) => [u.id, u.email]));

  await Promise.all(
    notifications
      .filter((n) => emailEnabledUserIds.has(n.userId))
      .map((n) => {
        const email = emailByUserId.get(n.userId);
        return email ? sendEmail(n.organizationId, email, n.title, n.body, n.userId) : Promise.resolve();
      })
  );
}

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
    const notification = await prisma.notification.create({ data: { ...data, data: data.data as Prisma.InputJsonValue } });
    await dispatch([notification]);
    return notification;
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

    const notifications = await prisma.notification.createManyAndReturn({
      data: users.map((u) => ({
        organizationId,
        userId: u.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data as Prisma.InputJsonValue,
      })),
    });
    await dispatch(notifications);
  },

  /** Same as broadcastToOrganization, but scoped to a single role (e.g. security alerts for admins only). */
  async broadcastToRole(
    organizationId: string,
    role: UserRoleLevel,
    payload: { type: string; title: string; body: string; data?: Record<string, unknown> }
  ) {
    const users = await prisma.user.findMany({
      where: { organizationId, role, status: true, deletedAt: null },
      select: { id: true },
    });
    if (users.length === 0) return;

    const notifications = await prisma.notification.createManyAndReturn({
      data: users.map((u) => ({
        organizationId,
        userId: u.id,
        type: payload.type,
        title: payload.title,
        body: payload.body,
        data: payload.data as Prisma.InputJsonValue,
      })),
    });
    await dispatch(notifications);
  },

  /** In-app is always on (there's no row/toggle for it); only opt-in channels like EMAIL show up here. */
  async getSettings(userId: string) {
    return prisma.notificationSetting.findMany({ where: { userId } });
  },

  async setChannelEnabled(userId: string, channel: NotificationChannel, enabled: boolean) {
    return prisma.notificationSetting.upsert({
      where: { userId_channel: { userId, channel } },
      update: { enabled },
      create: { userId, channel, enabled },
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
