import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { getAgentMetrics } from "@/server/admin/ai";

export const GET = withAdminHandler(async (_req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "ai_agents", action: "read" });

  const metrics = await getAgentMetrics();
  return NextResponse.json(metrics);
});
