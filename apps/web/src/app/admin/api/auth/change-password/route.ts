import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withAdminHandler } from "@/server/http";
import { requireAdmin, invalidateAdminSessions, createAdminSession } from "@/server/admin/auth";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/server/auth/password";
import { logAudit } from "@/server/admin/audit";
import { rateLimit, clientIp, formatRetryAfter } from "@/server/ratelimit/limiter";
import { logRateLimitBlock } from "@/server/ratelimit/logger";

const PW_CHANGE_PER_ADMIN = 5;
const PW_CHANGE_WINDOW_SEC = 900;

export const POST = withAdminHandler(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: "Current password and new password are required." }, { status: 400 });
  }

  if (currentPassword === newPassword) {
    return NextResponse.json({ error: "New password must differ from your current password." }, { status: 400 });
  }

  const strengthError = validatePasswordStrength(newPassword);
  if (strengthError) {
    return NextResponse.json({ error: strengthError }, { status: 400 });
  }

  // Rate limit password change attempts per admin
  const ip = clientIp(req.headers);
  const limit = await rateLimit(`admin:change-pw:${admin.id}`, PW_CHANGE_PER_ADMIN, PW_CHANGE_WINDOW_SEC);
  if (!limit.ok) {
    await logRateLimitBlock({
      type: "warning",
      ip,
      email: admin.email,
      endpoint: "admin.auth.change-password",
      reason: "Admin rate limit exceeded",
      userAgent: req.headers.get("user-agent") || undefined,
    });
    const humanTime = formatRetryAfter(limit.resetSec);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec: limit.resetSec },
      { status: 429, headers: { "Retry-After": String(limit.resetSec) } }
    );
  }

  const valid = await verifyPassword(currentPassword, admin.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect." }, { status: 401 });
  }

  const newHash = await hashPassword(newPassword);

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash: newHash },
  });

  await invalidateAdminSessions(admin.id);
  await createAdminSession(admin.id);
  await logAudit(admin.id, "admin.change_password", "admin_user", admin.id);

  return NextResponse.json({ success: true });
});
