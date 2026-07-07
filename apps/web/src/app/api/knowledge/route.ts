import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import {
  listKnowledge,
  createFaq,
  upsertPolicy,
  deleteFaq,
} from "@/server/knowledge/entries";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    return NextResponse.json(await listKnowledge(org.id));
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const body = await req.json();

    if (body.type === "policy") {
      const policy = await upsertPolicy(org.id, body);
      return NextResponse.json({ success: true, policy });
    }
    const faq = await createFaq(org.id, body);
    return NextResponse.json({ success: true, faq });
  });
}

export async function DELETE(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const params = new URL(req.url).searchParams;
    const id = params.get("id") ?? undefined;
    const question = params.get("question") ?? undefined;
    if (!id && !question) {
      return jsonError(400, "FAQ id or question is required.");
    }
    await deleteFaq(org.id, { id, question });
    return NextResponse.json({ success: true });
  });
}
