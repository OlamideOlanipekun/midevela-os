import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling } from "@/server/http";
import { listConversations, countConversations } from "@/server/conversations/conversations";

export async function GET(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 50));
    const [conversations, total] = await Promise.all([
      listConversations(org.id, page, limit),
      countConversations(org.id),
    ]);
    return NextResponse.json({ conversations, total, page, limit, pages: Math.ceil(total / limit) });
  });
}
