import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { logoutAdmin } from "@/server/admin/auth";

export const POST = withAdminHandler(async (_req: NextRequest, _context) => {
  await logoutAdmin();
  return NextResponse.json({ success: true });
});
