import { NextRequest, NextResponse } from "next/server";
import { listRefunds, approveRefund, rejectRefund } from "@/lib/billing/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listRefunds({ orgId: sp.get("orgId") || undefined, page, limit });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.action === "approve") {
    const result = await approveRefund(body.id, body.adminId);
    return NextResponse.json(result);
  }
  if (body.action === "reject") {
    const result = await rejectRefund(body.id);
    return NextResponse.json(result);
  }
  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
