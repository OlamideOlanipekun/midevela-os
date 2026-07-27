import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError, assertOrigin } from "@/server/http";
import { requireUser } from "@/server/auth/context";
import { hashPassword, verifyPassword, validatePasswordStrength } from "@/server/auth/password";
import { invalidateUserSessions, createSession } from "@/server/auth/session";
import { rateLimit, clientIp, formatRetryAfter } from "@/server/ratelimit/limiter";

const PW_CHANGE_PER_USER = 5;
const PW_CHANGE_WINDOW_SEC = 900;

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    assertOrigin(req);

    const user = await requireUser();
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return jsonError(400, "Current password and new password are required.");
    }

    if (currentPassword === newPassword) {
      return jsonError(400, "New password must differ from your current password.");
    }

    const strengthError = validatePasswordStrength(newPassword);
    if (strengthError) return jsonError(400, strengthError);

    // Rate limit password change attempts per user
    const ip = clientIp(req.headers);
    const limit = await rateLimit(`change-pw:${user.id}`, PW_CHANGE_PER_USER, PW_CHANGE_WINDOW_SEC);
    if (!limit.ok) {
      const humanTime = formatRetryAfter(limit.resetSec);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec: limit.resetSec },
        { status: 429, headers: { "Retry-After": String(limit.resetSec) } }
      );
    }

    const valid = await verifyPassword(currentPassword, user.passwordHash);
    if (!valid) {
      return jsonError(401, "Current password is incorrect.");
    }

    const newHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    // Invalidate all existing sessions so the old password no longer works
    // on any device, then issue a fresh session for this request.
    await invalidateUserSessions(user.id);
    await createSession(user.id);

    return NextResponse.json({ success: true });
  });
}
