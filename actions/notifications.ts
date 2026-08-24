"use server"

import { updateTag } from "next/cache";
import { notificationService } from "@/services/notification.service";
import { getRequestContext } from "@/lib/tenant";

export async function listNotifications(page = 1, pageSize = 20, unreadOnly = false) {
  const { organizationId, userId } = await getRequestContext();
  return notificationService.list(organizationId, userId, page, pageSize, unreadOnly);
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
