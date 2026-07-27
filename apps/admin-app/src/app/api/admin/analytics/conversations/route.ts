import { NextResponse } from "next/server";
import { getConversationAnalytics } from "@/lib/analytics/service";

export async function GET() {
  const data = await getConversationAnalytics();
  return NextResponse.json(data);
}
