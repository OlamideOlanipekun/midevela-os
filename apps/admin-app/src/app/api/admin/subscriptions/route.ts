import { NextRequest, NextResponse } from "next/server";
import { listSubscriptions, updateSubscription } from "@/lib/billing/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listSubscriptions({ status: sp.get("status") || undefined, page, limit });
  return NextResponse.json(data);
}
