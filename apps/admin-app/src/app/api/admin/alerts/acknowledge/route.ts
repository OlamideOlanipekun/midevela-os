import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/alerts/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await acknowledgeAlert(body.id, body.adminId);
  return NextResponse.json(result);
}
