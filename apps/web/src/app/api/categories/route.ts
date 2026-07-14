import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import {
  listCategoriesForDashboard,
  createCategory,
  updateCategory,
  deleteCategory,
  reorderCategories,
} from "@/server/catalog/categories";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const categories = await listCategoriesForDashboard(org.id);
    return NextResponse.json({ categories });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const category = await createCategory(org.id, body);
    return NextResponse.json({ success: true, category });
  });
}

/** Also handles reordering: { orderedIds: string[] } instead of an id+patch. */
export async function PUT(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();

    if (Array.isArray(body.orderedIds)) {
      await reorderCategories(org.id, body.orderedIds);
      return NextResponse.json({ success: true });
    }

    if (!body.id) return jsonError(400, "Category id is required.");
    const category = await updateCategory(org.id, body.id, body);
    return NextResponse.json({ success: true, category });
  });
}

export async function DELETE(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError(400, "Category id is required.");
    await deleteCategory(org.id, id);
    return NextResponse.json({ success: true });
  });
}
