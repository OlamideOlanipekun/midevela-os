import { NextRequest, NextResponse } from "next/server";
import { getConversationDetail, getAIReasoning } from "@/lib/conversations/service";
import { requireAdmin } from "@/lib/middleware/admin-guard";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdmin(request);
    const { id } = await params;
    const data = await getConversationDetail(id);
    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
