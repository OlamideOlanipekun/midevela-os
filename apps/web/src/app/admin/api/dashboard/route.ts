import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { getDashboardMetrics } from "@/server/admin/dashboard";

export const GET = withErrorHandling(async (_req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "dashboard", action: "read" });

  const metrics = await getDashboardMetrics();
  return NextResponse.json(metrics);
});
