import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { loginAsAdmin } from "@/server/admin/auth";

export const POST = withErrorHandling(async (req: NextRequest, _context) => {
  const { email, password } = await req.json();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
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
