import { NextRequest, NextResponse } from "next/server";
import { updateSubscription } from "@/lib/billing/service";

export async function PATCH(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await _request.json();
  const result = await updateSubscription(id, body);
  return NextResponse.json(result);
}
