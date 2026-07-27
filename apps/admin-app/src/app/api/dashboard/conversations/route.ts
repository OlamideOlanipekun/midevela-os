import { NextRequest, NextResponse } from "next/server";
import { getConversationTrendData } from "@/lib/dashboard/service";

export async function GET(request: NextRequest) {
  const days = Math.min(Number(request.nextUrl.searchParams.get("days")) || 7, 90);
  const data = await getConversationTrendData(days);
  return NextResponse.json(data);
}
