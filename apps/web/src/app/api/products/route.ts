import { NextRequest, NextResponse } from "next/server";
import { requireOrg, requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import {
  listProducts,
  createProduct,
  updateProduct,
  deleteProduct,
} from "@/server/catalog/products";

export async function GET() {
  return withErrorHandling(async () => {
    const { org } = await requireOrg();
    const products = await listProducts(org.id);
    return NextResponse.json({ products });
  });
}

export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const product = await createProduct(org.id, body);
    return NextResponse.json({ success: true, product });
  }, req);
}

export async function PUT(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    if (!body.id) return jsonError(400, "Product id is required.");
    const product = await updateProduct(org.id, body.id, body);
    return NextResponse.json({ success: true, product });
  }, req);
}

export async function DELETE(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return jsonError(400, "Product ID is required.");
    await deleteProduct(org.id, id);
    return NextResponse.json({ success: true });
  }, req);
}
