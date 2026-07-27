import { NextRequest, NextResponse } from "next/server";
import { listConversations } from "@/lib/conversations/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));

  const data = await listConversations({
    search: sp.get("search") || undefined,
    status: sp.get("status") || undefined,
    merchant: sp.get("merchant") || undefined,
    intent: sp.get("intent") || undefined,
    confidence: sp.get("confidence") || undefined,
    escalated: sp.get("escalated") || undefined,
    country: sp.get("country") || undefined,
    dateFrom: sp.get("dateFrom") || undefined,
    dateTo: sp.get("dateTo") || undefined,
    page, limit,
  });

  return NextResponse.json(data);
}
