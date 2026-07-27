import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { rateLimit, clientIp } from "@/server/ratelimit/limiter";
import { seedAdminSystem } from "@/server/admin/seed";

export const POST = withAdminHandler(async (req: NextRequest, _context) => {
  const ip = clientIp(req.headers);
  const rl = await rateLimit(`admin:setup:${ip}`, 3, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait." },
      { status: 429, headers: { "Retry-After": String(rl.resetSec) } }
    );
  }

  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name are required" }, { status: 400 });
  }

  const result = await seedAdminSystem(email, password, name);
  return NextResponse.json(result);
});
