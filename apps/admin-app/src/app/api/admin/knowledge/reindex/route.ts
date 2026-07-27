import { NextRequest, NextResponse } from "next/server";
import { reindexDocument, reindexAll } from "@/lib/knowledge/service";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (body.all && body.orgId) {
    await reindexAll(body.orgId);
    return NextResponse.json({ ok: true });
  }
  if (body.documentId) {
    await reindexDocument(body.documentId);
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ error: "Provide documentId or {orgId, all:true}" }, { status: 400 });
}
