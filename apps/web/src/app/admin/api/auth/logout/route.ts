import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { logoutAdmin } from "@/server/admin/auth";

export const POST = withErrorHandling(async (_req: NextRequest, _context) => {
  await logoutAdmin();
  return NextResponse.json({ success: true });
});
