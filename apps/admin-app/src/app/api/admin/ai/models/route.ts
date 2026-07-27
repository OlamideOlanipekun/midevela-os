import { NextRequest, NextResponse } from "next/server";
import { listModelRoutes, updateModelRoute } from "@/lib/ai/service";

export async function GET() {
  const routes = await listModelRoutes();
  return NextResponse.json(routes);
}

export async function PATCH(request: NextRequest) {
  const body = await request.json();
  const route = await updateModelRoute(body.id, body);
  return NextResponse.json(route);
}
