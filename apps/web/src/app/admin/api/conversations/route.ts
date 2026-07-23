import { NextRequest, NextResponse } from "next/server";
import { withAdminHandler } from "@/server/http";
import { requireAdmin } from "@/server/admin/auth";
import { requirePermission } from "@/server/admin/rbac";
import { listAdminConversations, getConversationDetail } from "@/server/admin/conversations";

export const GET = withAdminHandler(async (req: NextRequest, _context) => {
  const admin = await requireAdmin();
  await requirePermission(admin, { module: "conversations", action: "read" });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (id) {
    const conversation = await getConversationDetail(id);
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(conversation);
  }

  const options = {
    limit: Math.min(Number(searchParams.get("limit")) || 50, 100),
    offset: Number(searchParams.get("offset")) || 0,
    status: searchParams.get("status") || undefined,
    search: searchParams.get("search") || undefined,
    orgId: searchParams.get("orgId") || undefined,
  };

  const result = await listAdminConversations(options);
  return NextResponse.json(result);
});
