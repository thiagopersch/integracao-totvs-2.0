"use server"

import { updateTag } from "next/cache";
import { notificationService } from "@/services/notification.service";
import { getRequestContext } from "@/lib/tenant";
import type { NotificationChannel } from "@prisma/client";

export async function listNotifications(
  page = 1,
  pageSize = 20,
  unreadOnly = false,
  sort?: { field: string; direction: "asc" | "desc" }
) {
  const { organizationId, userId } = await getRequestContext();
  return notificationService.list(organizationId, userId, page, pageSize, unreadOnly, sort);
}

export async function markNotificationAsRead(id: string) {
  const { userId } = await getRequestContext();
  try {
    await notificationService.markAsRead(id, userId);
    updateTag("notifications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function markAllNotificationsAsRead() {
  const { organizationId, userId } = await getRequestContext();
  try {
    await notificationService.markAllAsRead(organizationId, userId);
    updateTag("notifications");
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getNotificationSettings() {
  const { userId } = await getRequestContext();
  return notificationService.getSettings(userId);
}

export async function updateNotificationSetting(channel: NotificationChannel, enabled: boolean) {
  const { userId } = await getRequestContext();
  try {
    await notificationService.setChannelEnabled(userId, channel, enabled);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
