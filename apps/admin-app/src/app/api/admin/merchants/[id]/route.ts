import { NextRequest, NextResponse } from "next/server";
import { getMerchantDetail } from "@/lib/merchant/service";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { logAudit } from "@/lib/auth/audit";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const data = await getMerchantDetail(id);
    await logAudit(admin.sub, "merchant_viewed", "merchant", id);
    return NextResponse.json(data);
  } catch (e: any) {
    const status = e.status || 500;
    return NextResponse.json({ error: e.message || "Internal error" }, { status });
  }
}
