import { NextRequest, NextResponse } from "next/server";
import { getSupportDashboard, listTickets, createTicket } from "@/lib/support/service";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  if (sp.get("dashboard") === "true") {
    const data = await getSupportDashboard();
    return NextResponse.json(data);
  }
  const page = Math.max(1, Number(sp.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 20));
  const data = await listTickets({
    status: sp.get("status") || undefined,
    priority: sp.get("priority") || undefined,
    assignedTo: sp.get("assignedTo") || undefined,
    search: sp.get("search") || undefined,
    page, limit,
  });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const ticket = await createTicket(body);
  return NextResponse.json(ticket, { status: 201 });
}
