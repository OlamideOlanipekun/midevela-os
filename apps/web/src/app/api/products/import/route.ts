import { NextRequest, NextResponse } from "next/server";
import { requireActiveOrg } from "@/server/auth/context";
import { withErrorHandling, jsonError } from "@/server/http";
import { importProducts, type ImportRow } from "@/server/catalog/products";

/**
 * Bulk product import. The client parses the CSV/Excel (dependency-free, in
 * the browser) and POSTs a JSON array of rows here — avoids multipart
 * handling and keeps the server contract simple. Returns a three-way,
 * per-row result (imported / skipped / warning), never a silent import.
 */
export async function POST(req: NextRequest) {
  return withErrorHandling(async () => {
    const { org } = await requireActiveOrg();
    const body = await req.json();
    const rows = body?.rows;
    if (!Array.isArray(rows)) {
      return jsonError(400, "Expected { rows: [...] }.");
    }
    const result = await importProducts(org.id, rows as ImportRow[]);
    return NextResponse.json({ success: true, ...result });
  });
}
