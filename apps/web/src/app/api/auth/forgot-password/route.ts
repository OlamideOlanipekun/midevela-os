import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { hashPassword } from "@/server/auth/password";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";
import { logRateLimitBlock } from "@/server/ratelimit/logger";

const RESET_WINDOW_SEC = 30 * 60;
const RESET_PER_EMAIL = 1;
const RESET_PER_IP = 3;

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();

    if (!email || !email.includes("@")) {
      return jsonError(400, "A valid email is required.");
    }

    const ip = clientIp(req.headers);
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit(identityKey("forgot-password", ip, email), RESET_PER_IP, RESET_WINDOW_SEC),
      rateLimit(`forgot-password:email:${email}`, RESET_PER_EMAIL, RESET_WINDOW_SEC),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      await logRateLimitBlock({
        type: "warning",
        ip,
        email,
        endpoint: "auth.forgot-password",
        reason: !ipLimit.ok ? "IP/identity rate limit exceeded" : "Email rate limit exceeded",
        userAgent: req.headers.get("user-agent") || undefined,
      });
      const retryAfter = Math.max(ipLimit.resetSec, emailLimit.resetSec);
      const humanTime = formatRetryAfter(retryAfter);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${humanTime}.`, retryAfterSec: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    // Best-effort cleanup of expired or used tokens to prevent table bloat (H5)
    await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { email },
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },
        ],
      },
    }).catch(() => undefined);

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return the same message — never reveal whether the email exists.
    if (user) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_WINDOW_SEC * 1000);

      await prisma.passwordResetToken.create({
        data: { email, tokenHash, expiresAt },
      });

      // TODO: Send email with reset link containing the raw token
      // e.g. `https://midevela.com/reset-password?token=${token}`
      console.log(`[password-reset] Token created for ${email} (expires ${expiresAt.toISOString()})`);
    } else {
      // Constant-time delay to prevent email enumeration via timing (M1)
      await hashPassword("dummy-constant-time-guard");
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  }, req);
}
