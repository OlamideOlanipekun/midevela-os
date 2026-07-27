import { NextRequest, NextResponse } from "next/server";
import { listCategories } from "@/lib/catalog/service";

export async function GET(request: NextRequest) {
  const orgId = request.nextUrl.searchParams.get("orgId");
  if (!orgId) return NextResponse.json({ error: "orgId required" }, { status: 400 });
  const categories = await listCategories(orgId);
  return NextResponse.json(categories);
}
