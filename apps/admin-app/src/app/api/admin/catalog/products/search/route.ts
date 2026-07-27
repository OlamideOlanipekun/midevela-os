import { NextRequest, NextResponse } from "next/server";
import { getProductSearch } from "@/lib/catalog/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const results = await getProductSearch(body);
  return NextResponse.json(results);
}
