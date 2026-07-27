import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/lib/middleware/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const ip = clientIp(req.headers);
    const rl = await rateLimit(identityKey("admin:forgot-password", ip, email), 3, 1800);
    if (!rl.ok) {
      const humanTime = formatRetryAfter(rl.resetSec);
      return NextResponse.json(
        { error: `Too many requests. Try again in ${humanTime}.`, retryAfterSec: rl.resetSec },
        { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
      );
    }
    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (admin) {
      // TODO: Integrate email service to send reset link
      // For now, log the request
      console.log(`Password reset requested for ${email}`);
    }

    return NextResponse.json({
      message: "If an account with that email exists, a password reset link has been sent.",
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
