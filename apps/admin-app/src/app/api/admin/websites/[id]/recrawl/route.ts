import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { recrawlWebsite } from "@/lib/websites/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const data = await recrawlWebsite(id, admin.sub);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
