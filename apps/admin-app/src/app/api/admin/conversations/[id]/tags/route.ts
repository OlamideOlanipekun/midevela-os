import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/middleware/admin-guard";
import { addTag, removeTag } from "@/lib/conversations/service";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const data = body.action === "remove"
      ? await removeTag(id, body.tag, admin.sub)
      : await addTag(id, body.tag, admin.sub);
    return NextResponse.json({ tags: data });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal error" }, { status: e.status || 500 });
  }
}
