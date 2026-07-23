import prisma from "@/lib/prisma";

export async function listNotifications(adminId: string, limit = 20) {
  const items = await prisma.notification.findMany({
    where: { adminId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const unreadCount = await prisma.notification.count({
    where: { adminId, read: false },
  });

  return { items, unreadCount };
}

export async function markNotificationRead(adminId: string, notificationId: string) {
  await prisma.notification.updateMany({
    where: { id: notificationId, adminId },
    data: { read: true },
  });
}

export async function markAllNotificationsRead(adminId: string) {
  await prisma.notification.updateMany({
    where: { adminId, read: false },
    data: { read: true },
  });
}

export async function createNotification(
  adminId: string,
  type: string,
  title: string,
  message?: string,
  link?: string
) {
  return prisma.notification.create({
    data: { adminId, type, title, message, link },
  });
}
