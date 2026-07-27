import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { loginAsAdmin } from "@/server/admin/auth";
import { rateLimit, clientIp, identityKey, formatRetryAfter } from "@/server/ratelimit/limiter";
import { logRateLimitBlock } from "@/server/ratelimit/logger";

const ADMIN_LOGIN_WINDOW_SEC = 900;
const ADMIN_LOGIN_PER_IP = 10;

export const POST = withAdminHandler(async (req: NextRequest, _context) => {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const ipLimit = await rateLimit(identityKey("admin:login", ip, email), ADMIN_LOGIN_PER_IP, ADMIN_LOGIN_WINDOW_SEC);
  if (!ipLimit.ok) {
    await logRateLimitBlock({
      type: "warning",
      ip,
      email,
      endpoint: "admin.auth.login",
      reason: "IP/identity rate limit exceeded",
      userAgent: req.headers.get("user-agent") || undefined,
    });
    const humanTime = formatRetryAfter(ipLimit.resetSec);
    return NextResponse.json(
      { error: `Too many attempts. Try again in ${humanTime}.`, retryAfterSec: ipLimit.resetSec },
      { status: 429, headers: { "Retry-After": String(ipLimit.resetSec) } }
    );
  }

  const user = await loginAsAdmin(email, password, ip);

  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      avatarUrl: user.avatarUrl,
    },
  });
});
