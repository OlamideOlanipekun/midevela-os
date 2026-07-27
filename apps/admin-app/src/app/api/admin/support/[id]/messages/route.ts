import { NextRequest, NextResponse } from "next/server";
import { addMessage } from "@/lib/support/service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const message = await addMessage(id, body);
  return NextResponse.json(message, { status: 201 });
}
