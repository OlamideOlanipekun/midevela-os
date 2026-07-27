import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import prisma from "@/lib/prisma";
import { withErrorHandling, jsonError } from "@/server/http";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";

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
      const retryAfter = Math.min(ipLimit.resetSec, emailLimit.resetSec);
      const humanTime = formatRetryAfter(retryAfter);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${humanTime}.`, retryAfterSec: retryAfter },
        { status: 429, headers: { "Retry-After": String(retryAfter) } }
      );
    }

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
      // Constant-time delay to prevent email enumeration
      await new Promise((r) => setTimeout(r, 100));
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  });
}
