import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { listFeatureFlags, toggleFeatureFlag } from "@/server/admin/features";

export const GET = withErrorHandling(async (_req, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "feature_flags", action: "read" });

  const flags = await listFeatureFlags();
  return NextResponse.json({ items: flags });
});

export const PATCH = withErrorHandling(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "feature_flags", action: "write" });

  const { id, enabled } = await req.json();
  const flag = await toggleFeatureFlag(id, enabled);
  return NextResponse.json(flag);
});
