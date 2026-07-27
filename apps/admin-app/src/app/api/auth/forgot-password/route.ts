import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/lib/middleware/rate-limit";

const RESET_WINDOW_SEC = 30 * 60;

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const ip = clientIp(req.headers);
    const rl = await rateLimit(identityKey("admin:forgot-password", ip, email), 3, RESET_WINDOW_SEC);
    if (!rl.ok) {
      const humanTime = formatRetryAfter(rl.resetSec);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${humanTime}.`, retryAfterSec: rl.resetSec },
        { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
      );
    }

    const admin = await prisma.admin.findUnique({ where: { email } });

    // Never reveal whether the email exists.
    if (admin) {
      const token = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_WINDOW_SEC * 1000);

      await prisma.passwordResetToken.create({
        data: { email, tokenHash, expiresAt },
      });

      // TODO: Integrate email service to send reset link
      console.log(`[password-reset] Admin token created for ${email}`);
    } else {
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch (err) {
    console.error("Forgot-password error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
