import { NextRequest, NextResponse } from "next/server";
import { withErrorHandling } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { listMerchants } from "@/server/admin/merchants";

export const GET = withErrorHandling(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "merchants", action: "read" });

  const { searchParams } = new URL(req.url);
  const options = {
    limit: Math.min(Number(searchParams.get("limit")) || 50, 100),
    offset: Number(searchParams.get("offset")) || 0,
    search: searchParams.get("search") || undefined,
    status: searchParams.get("status") || undefined,
    plan: searchParams.get("plan") || undefined,
    sortBy: searchParams.get("sortBy") || "createdAt",
    sortDir: (searchParams.get("sortDir") || "desc") as "asc" | "desc",
  };

  const result = await listMerchants(options);
  return NextResponse.json(result);
});
