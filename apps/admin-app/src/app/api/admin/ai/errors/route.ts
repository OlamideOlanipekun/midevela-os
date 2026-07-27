import { NextRequest, NextResponse } from "next/server";
import { listAIErrors } from "@/lib/ai/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listAIErrors({
    orgId: sp.get("orgId") || undefined,
    model: sp.get("model") || undefined,
    type: sp.get("type") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}
