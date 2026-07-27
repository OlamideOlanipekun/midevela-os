import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { exportConversation } from "@/lib/conversations/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const format = body.format || "txt";
    const data = await exportConversation(id, format, admin.sub);
    return new NextResponse(data.content, {
      headers: {
        "Content-Type": data.type,
        "Content-Disposition": `attachment; filename="${data.filename}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
