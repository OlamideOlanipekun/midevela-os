import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { getMessages } from "@/lib/conversations/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const before = request.nextUrl.searchParams.get("before") || undefined;
    const limit = Math.min(100, Number(request.nextUrl.searchParams.get("limit")) || 50);
    const data = await getMessages(id, before, limit);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
