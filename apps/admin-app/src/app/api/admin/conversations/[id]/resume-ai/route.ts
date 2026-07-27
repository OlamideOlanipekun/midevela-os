import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { resumeAI } from "@/lib/conversations/service";
import { broadcastConversationEvent } from "@/lib/conversations/events";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    await resumeAI(id, admin.sub);
    broadcastConversationEvent({ type: "ai.resumed", conversationId: id });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
