import { NextRequest, NextResponse } from "next/server";
import { getWebsiteDetail, checkDuplicate } from "@/lib/websites/service";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { logAudit } from "@/lib/auth/audit";
import { normalizeDomain } from "@/lib/websites/normalizer";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const data = await getWebsiteDetail(id);
    await logAudit(admin.sub, "website_viewed", "website", id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
