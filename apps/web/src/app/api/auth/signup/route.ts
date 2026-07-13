import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { hashPassword, validatePasswordStrength } from "@/server/auth/password";
import { createSession } from "@/server/auth/session";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";

const SIGNUP_WINDOW_SEC = 60 * 60;
const SIGNUP_PER_IP = 5;

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    // Throttle account-creation spam (and the scrypt CPU cost each attempt
    // incurs) by source IP.
    const ip = clientIp(req.headers);
    const ipLimit = await rateLimit(`signup:ip:${ip}`, SIGNUP_PER_IP, SIGNUP_WINDOW_SEC);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Too many sign-up attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": String(SIGNUP_WINDOW_SEC) } }
      );
    }

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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
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
