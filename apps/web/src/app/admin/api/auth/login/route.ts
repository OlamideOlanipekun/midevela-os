import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { loginAsAdmin } from "@/server/admin/auth";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";

const ADMIN_LOGIN_WINDOW_SEC = 900;
const ADMIN_LOGIN_PER_IP = 10;

export const POST = withAdminHandler(async (req: NextRequest, _context) => {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const ip = clientIp(req.headers);
  const ipLimit = await rateLimit(`admin:login:ip:${ip}`, ADMIN_LOGIN_PER_IP, ADMIN_LOGIN_WINDOW_SEC);
  if (!ipLimit.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
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
