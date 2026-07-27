import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";
import { logRateLimitBlock } from "@/server/ratelimit/logger";

const SIGNUP_WINDOW_SEC = 15 * 60;
const SIGNUP_PER_IP = 3;
const SIGNUP_PER_EMAIL = 3;

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    // Throttle account-creation spam (and the scrypt CPU cost each attempt
    // incurs) by source IP and email.
    const ip = clientIp(req.headers);
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");
    const name = String(body?.name ?? "").trim();

    if (!email || !email.includes("@")) {
      return jsonError(400, "A valid email is required.");
    }
    const strengthError = validatePasswordStrength(password);
    if (strengthError) return jsonError(400, strengthError);
    if (!name) return jsonError(400, "Name is required.");

    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit(identityKey("signup", ip, email), SIGNUP_PER_IP, SIGNUP_WINDOW_SEC),
      rateLimit(`signup:email:${email}`, SIGNUP_PER_EMAIL, SIGNUP_WINDOW_SEC),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      await logRateLimitBlock({
        type: "warning",
        ip,
        email,
        endpoint: "auth.signup",
        reason: !ipLimit.ok ? "IP/identity rate limit exceeded" : "Email rate limit exceeded",
        userAgent: req.headers.get("user-agent") || undefined,
      });
      const retryAfter = Math.min(ipLimit.resetSec, emailLimit.resetSec);
      const humanTime = formatRetryAfter(retryAfter);
      return NextResponse.json(
        { error: `Too many sign-up attempts. Try again in ${humanTime}.`, retryAfterSec: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Constant-delay to prevent email enumeration via timing: always
      // spend similar time before revealing whether the email exists.
      await hashPassword("dummy-constant-time-guard");
      return jsonError(409, "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role: "OWNER" },
    });

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, orgId: user.orgId },
    });
  });
}
