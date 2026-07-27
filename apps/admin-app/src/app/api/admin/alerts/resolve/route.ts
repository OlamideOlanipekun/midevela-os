import { NextRequest, NextResponse } from "next/server";
import { resolveAlert } from "@/lib/alerts/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const result = await resolveAlert(body.id);
  return NextResponse.json(result);
}
