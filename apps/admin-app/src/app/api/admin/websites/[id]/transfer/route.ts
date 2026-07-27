import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { transferWebsite } from "@/lib/websites/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const data = await transferWebsite(id, body.newOrgId, admin.sub);
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
