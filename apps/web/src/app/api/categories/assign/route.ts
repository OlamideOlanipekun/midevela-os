import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { assignProductsToCategory } from "@/server/catalog/categories";

/** Bulk-categorize products — how a merchant fixes uncategorized (e.g.
 *  crawled) products without editing each one individually. */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const productIds = Array.isArray(body.productIds) ? body.productIds.filter((id: unknown) => typeof id === "string") : [];
    if (productIds.length === 0) return jsonError(400, "productIds is required.");
    const categoryId = typeof body.categoryId === "string" && body.categoryId ? body.categoryId : null;
    await assignProductsToCategory(org.id, categoryId, productIds);
    return NextResponse.json({ success: true });
  });
}
