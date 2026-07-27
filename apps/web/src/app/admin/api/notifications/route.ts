import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { rateLimit } from "@/server/ratelimit/limiter";
import { listNotifications, markNotificationRead, markAllNotificationsRead } from "@/server/admin/notifications";

export const GET = withAdminHandler(async (_req, _context) => {
  const admin = await requireAdmin();
  const result = await listNotifications(admin.id);
  return NextResponse.json(result);
});

export const PATCH = withAdminHandler(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  const rl = await rateLimit(`admin:notifications:${admin.id}`, 30, 10);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
    );
  }
  const { id, all } = await req.json();

  if (all) {
    await markAllNotificationsRead(admin.id);
  } else if (id) {
    await markNotificationRead(admin.id, id);
  }

  return NextResponse.json({ success: true });
});
