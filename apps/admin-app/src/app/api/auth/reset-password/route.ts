import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth/password";
import { revokeAllSessions } from "@/lib/auth/session";
import { logAudit } from "@/lib/auth/audit";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/lib/middleware/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { token, password } = await req.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    const ip = clientIp(req.headers);
    const rl = await rateLimit(identityKey("admin:reset-password", ip, token), 5, 3600);
    if (!rl.ok) {
      const humanTime = formatRetryAfter(rl.resetSec);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${humanTime}.`, retryAfterSec: rl.resetSec },
        { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
      );
    }
    if (!token || !password) {
      return NextResponse.json({ error: "Token and password are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    // TODO: Verify reset token from email link
    // For now, this is a placeholder — the email service integration
    // will generate a time-limited signed token stored in the DB.

    return NextResponse.json({ error: "Password reset is not fully configured yet. Contact support." }, { status: 501 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
