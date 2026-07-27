import { NextRequest, NextResponse } from "next/server";
import { getTicket, updateTicket } from "@/lib/support/service";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ticket = await getTicket(id);
  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  return NextResponse.json(ticket);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const ticket = await updateTicket(id, body);
  return NextResponse.json(ticket);
}
