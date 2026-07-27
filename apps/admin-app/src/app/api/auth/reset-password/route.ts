import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
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

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email: resetToken.email } });
    if (!admin) {
      return NextResponse.json({ error: "Invalid or expired reset token." }, { status: 400 });
    }

    const newHash = await hashPassword(password);

    await prisma.admin.update({
      where: { id: admin.id },
      data: { passwordHash: newHash },
    });

    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    });

    await revokeAllSessions(admin.id);
    await logAudit(admin.id, "password.reset", "auth", admin.id, { ip }, ip, req.headers.get("user-agent") || undefined);

    return NextResponse.json({ message: "Password has been reset successfully." });
  } catch (err) {
    console.error("Reset-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
