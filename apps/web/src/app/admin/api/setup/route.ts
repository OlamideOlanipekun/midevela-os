import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { seedAdminSystem } from "@/server/admin/seed";

export const POST = withErrorHandling(async (req: NextRequest, _context) => {
  const { email, password, name } = await req.json();

  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password, and name are required" }, { status: 400 });
  }

  const result = await seedAdminSystem(email, password, name);
  return NextResponse.json(result);
});
