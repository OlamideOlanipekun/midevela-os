import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";
import { logRateLimitBlock } from "@/server/ratelimit/logger";

const LOGIN_WINDOW_SEC = 15 * 60;
const LOGIN_PER_IP = 10;
const LOGIN_PER_EMAIL = 10;

function tooManyRequests(retryAfterSec: number) {
  const humanTime = formatRetryAfter(retryAfterSec);
  return NextResponse.json(
    { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const body = await req.json();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    if (!email || !password) {
      return jsonError(400, "Email and password are required.");
    }

    // Throttle brute force by a composite key (IP + email) so one
    // user's abuse never blocks unrelated users behind the same NAT.
    const ip = clientIp(req.headers);
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit(identityKey("login", ip, email), LOGIN_PER_IP, LOGIN_WINDOW_SEC),
      rateLimit(`login:email:${email}`, LOGIN_PER_EMAIL, LOGIN_WINDOW_SEC),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      await logRateLimitBlock({
        type: "warning",
        ip,
        email,
        endpoint: "auth.login",
        reason: !ipLimit.ok ? "IP/identity rate limit exceeded" : "Email rate limit exceeded",
        userAgent: req.headers.get("user-agent") || undefined,
      });
      return tooManyRequests(Math.max(ipLimit.resetSec, emailLimit.resetSec));
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was. Critically, verifyPassword always runs (against a
    // dummy hash when there's no user) so a nonexistent email takes the
    // same scrypt-bound time as a wrong password on a real one — otherwise
    // the response *timing* would leak what the identical error message
    // doesn't.
    const passwordValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
    if (!user || !passwordValid) {
      return jsonError(401, "Invalid email or password.");
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, orgId: user.orgId },
    });
  }, req);
}
