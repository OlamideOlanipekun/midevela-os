import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { getAuditLogs } from "@/server/admin/audit";

export const GET = withErrorHandling(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "audit_logs", action: "read" });

  const { searchParams } = new URL(req.url);
  const options = {
    limit: Math.min(Number(searchParams.get("limit")) || 50, 100),
    offset: Number(searchParams.get("offset")) || 0,
    action: searchParams.get("action") || undefined,
    resource: searchParams.get("resource") || undefined,
  };

  const result = await getAuditLogs(options);
  return NextResponse.json(result);
});
