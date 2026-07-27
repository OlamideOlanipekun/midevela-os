import { NextRequest, NextResponse } from "next/server";
import { listSecurityEvents, logSecurityEvent } from "@/lib/audit/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listSecurityEvents({
    type: sp.get("type") || undefined,
    severity: sp.get("severity") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const event = await logSecurityEvent(body);
  return NextResponse.json(event, { status: 201 });
}
