import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getActivity } from "@/lib/merchant/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const limit = Math.min(100, Number(request.nextUrl.searchParams.get("limit")) || 50);
    const data = await getActivity(id, limit);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
