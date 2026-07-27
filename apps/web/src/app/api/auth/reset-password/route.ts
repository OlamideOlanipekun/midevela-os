import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { invalidateUserSessions, createSession } from "@/server/auth/session";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";

const RESET_PW_WINDOW_SEC = 15 * 60;
const RESET_PW_PER_TOKEN = 3;

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = await req.json();
    const token = String(body?.token ?? "");
    const password = String(body?.password ?? "");

    if (!token || !password) {
      return jsonError(400, "Token and new password are required.");
    }

    const strengthError = validatePasswordStrength(password);
    if (strengthError) return jsonError(400, strengthError);

    const ip = clientIp(req.headers);
    const limit = await rateLimit(identityKey("reset-password", ip, token), RESET_PW_PER_TOKEN, RESET_PW_WINDOW_SEC);
    if (!limit.ok) {
      const humanTime = formatRetryAfter(limit.resetSec);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec: limit.resetSec },
        { status: 429, headers: { "Retry-After": String(limit.resetSec) } }
      );
    }

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken) {
      return jsonError(400, "Invalid or expired reset token.");
    }

    if (resetToken.usedAt) {
      return jsonError(400, "This reset link has already been used.");
    }

    if (resetToken.expiresAt < new Date()) {
      return jsonError(400, "This reset link has expired. Please request a new one.");
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.findUnique({ where: { email: resetToken.email } });
    if (!user) {
      return jsonError(400, "Invalid or expired reset token.");
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await invalidateUserSessions(user.id);
    await createSession(user.id);

    return NextResponse.json({ success: true });
  });
}
