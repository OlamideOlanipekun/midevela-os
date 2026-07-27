import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, DUMMY_PASSWORD_HASH } from "@/lib/auth/password";
import { createSession } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/lib/middleware/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const ip = clientIp(req.headers);
    const ipLimit = await rateLimit(identityKey("admin:login", ip, email), 10, 900);
    if (!ipLimit.ok) {
      const humanTime = formatRetryAfter(ipLimit.resetSec);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec: ipLimit.resetSec },
        { status: 429, headers: { "Retry-After": String(ipLimit.resetSec) } }
      );
    }
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      await verifyPassword(password, DUMMY_PASSWORD_HASH);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    if (!admin.isActive) {
      return NextResponse.json({ error: "Account is deactivated" }, { status: 403 });
    }

    const valid = await verifyPassword(password, admin.passwordHash);
    if (!valid) {
      await logAudit(admin.id, "login.failed", "auth", undefined, { ip }, ip, req.headers.get("user-agent") || undefined);
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const userAgent = req.headers.get("user-agent") || undefined;
    const device = userAgent ? parseDevice(userAgent) : undefined;
    const browser = userAgent ? parseBrowser(userAgent) : undefined;

    const result = await createSession(admin.id, ip, device, browser);
    if (!result) {
      return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
    }

    await prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    });

    await logAudit(admin.id, "login.success", "auth", admin.id, { ip }, ip, userAgent);

    return NextResponse.json({
      accessToken: result.pair.accessToken,
      refreshToken: result.pair.refreshToken,
      admin: result.session,
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function parseDevice(ua: string): string {
  if (/mobile|android|iphone|ipad/i.test(ua)) return "Mobile";
  return "Desktop";
}

function parseBrowser(ua: string): string {
  if (ua.includes("Edg")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  return "Unknown";
}
