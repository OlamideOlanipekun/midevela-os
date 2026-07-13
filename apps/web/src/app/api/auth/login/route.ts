import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { verifyPassword } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";

const LOGIN_WINDOW_SEC = 15 * 60;
const LOGIN_PER_IP = 10;
const LOGIN_PER_EMAIL = 10;

function tooManyRequests(retryAfterSec: number) {
  return NextResponse.json(
    { error: "Too many attempts. Please wait a few minutes and try again." },
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

    // Throttle brute force by both source IP and target account.
    const ip = clientIp(req.headers);
    const [ipLimit, emailLimit] = await Promise.all([
      rateLimit(`login:ip:${ip}`, LOGIN_PER_IP, LOGIN_WINDOW_SEC),
      rateLimit(`login:email:${email}`, LOGIN_PER_EMAIL, LOGIN_WINDOW_SEC),
    ]);
    if (!ipLimit.ok || !emailLimit.ok) {
      return tooManyRequests(LOGIN_WINDOW_SEC);
    }

    const user = await prisma.user.findUnique({ where: { email } });
    // Same error for "no such user" and "wrong password" — don't leak
    // which one it was.
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return jsonError(401, "Invalid email or password.");
    }

    await createSession(user.id);

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, orgId: user.orgId },
    });
  });
}
